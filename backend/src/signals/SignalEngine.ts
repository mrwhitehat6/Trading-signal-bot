import type { TradingSignal } from '../types';
import { getOHLCV, getLatestPrice } from '../market/MarketDataProvider';
import { analyzeTechnicals } from '../analysis/TechnicalEngine';
import { runICTAnalysis } from '../analysis/ICTEngine';
import { analyzeVolume } from '../analysis/VolumeEngine';
import { analyzeLiquidity } from '../analysis/LiquidityEngine';
import {
  calculateConfidence,
  generateExplanation,
  CONFIDENCE_THRESHOLDS,
} from './ConfidenceEngine';
import { insertSignal, getSignalBySymbol } from '../db';
import { logEvent } from '../db';
import { analyzeWithGemini } from '../ai/GeminiAnalyzer';
import { evaluateRisk } from './RiskEngine';
import { processNewsForAsset } from '../news/NewsEngine';

// ─── Config ───────────────────────────────────────────────────────────────────
const SIGNAL_CONFIG = {
  MIN_CONFIDENCE: 75,
  MIN_RR: 1.5,
  COOLDOWN_MS: 30 * 60 * 1000,
  MAX_DAILY_SIGNALS: 20,
  ATR_STOP_MULTIPLIER: 1.5,
  ATR_TARGET_MULTIPLIER: 3.0,
  TIMEFRAME: '1m',
};

// Anti-spam state
const lastSignalTime: Map<string, number> = new Map();
let dailySignalCount = 0;
let lastDayReset = new Date().toDateString();

// ─── Risk Calculation ─────────────────────────────────────────────────────────
function calculateRisk(
  direction: 'LONG' | 'SHORT',
  entry: number,
  atr: number
): { stopLoss: number; takeProfit: number; riskReward: number } {
  const stop = atr * SIGNAL_CONFIG.ATR_STOP_MULTIPLIER;
  const target = atr * SIGNAL_CONFIG.ATR_TARGET_MULTIPLIER;

  let stopLoss: number;
  let takeProfit: number;

  if (direction === 'LONG') {
    stopLoss = entry - stop;
    takeProfit = entry + target;
  } else {
    stopLoss = entry + stop;
    takeProfit = entry - target;
  }

  const riskAmount = Math.abs(entry - stopLoss);
  const rewardAmount = Math.abs(takeProfit - entry);
  const riskReward = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  return { stopLoss, takeProfit, riskReward };
}

// ─── Anti-Spam / Duplicate Check ─────────────────────────────────────────────
function shouldGenerateSignal(symbol: string, direction: 'LONG' | 'SHORT'): boolean {
  const today = new Date().toDateString();
  if (today !== lastDayReset) {
    dailySignalCount = 0;
    lastDayReset = today;
  }

  if (dailySignalCount >= SIGNAL_CONFIG.MAX_DAILY_SIGNALS) return false;

  const key = `${symbol}:${direction}`;
  const lastTime = lastSignalTime.get(key) ?? 0;
  const elapsed = Date.now() - lastTime;

  if (elapsed < SIGNAL_CONFIG.COOLDOWN_MS) {
    const remaining = Math.ceil((SIGNAL_CONFIG.COOLDOWN_MS - elapsed) / 60_000);
    console.log(`[SIGNAL] Cooldown active for ${key} - ${remaining}m remaining`);
    return false;
  }

  const activeSignal = getSignalBySymbol(symbol);
  if (activeSignal) {
    console.log(`[SIGNAL] Active signal already exists for ${symbol}`);
    return false;
  }

  return true;
}

// ─── Signal Direction Decision ────────────────────────────────────────────────
function decideDirection(
  tech: ReturnType<typeof analyzeTechnicals>,
  ict: ReturnType<typeof runICTAnalysis>
): { direction: 'LONG' | 'SHORT' | 'NO_TRADE'; score: number } {
  if (!tech) return { direction: 'NO_TRADE', score: 0 };

  const bullishPoints =
    (tech.trend === 'BULLISH' ? 3 : 0) +
    (tech.rsi > 55 ? 2 : 0) +
    (tech.macdHist > 0 ? 1 : 0) +
    (ict.bullishScore / 20);

  const bearishPoints =
    (tech.trend === 'BEARISH' ? 3 : 0) +
    (tech.rsi < 45 ? 2 : 0) +
    (tech.macdHist < 0 ? 1 : 0) +
    (ict.bearishScore / 20);

  const diff = Math.abs(bullishPoints - bearishPoints);

  if (diff < 1.5) return { direction: 'NO_TRADE', score: 0 };
  if (bullishPoints > bearishPoints) return { direction: 'LONG', score: bullishPoints };
  return { direction: 'SHORT', score: bearishPoints };
}

export function selectStrategy(tech: any, ict: any) {
  if (ict.hasBullishMSS || ict.hasBearishMSS) return { strategy: 'ICT_SMC', display: 'Liquidity Sweep + MSS' };
  if (tech.trend !== 'SIDEWAYS') return { strategy: 'TREND_FOLLOWING', display: 'Trend Following' };
  return { strategy: 'EMA_RSI', display: 'EMA + RSI Cross' };
}

// ─── Main Signal Generation ───────────────────────────────────────────────────
export async function generateSignal(symbol: string): Promise<TradingSignal | null> {
  console.log(`[SIGNAL] Analyzing ${symbol}...`);

  try {
    const [tick, candles] = await Promise.all([
      getLatestPrice(symbol),
      getOHLCV(symbol, SIGNAL_CONFIG.TIMEFRAME, 250),
    ]);

    if (!candles || candles.length < 200) return null;

    const currentPrice = tick.price;
    const tech = analyzeTechnicals(candles);
    if (!tech) return null;

    const ict = runICTAnalysis(candles);
    const volumeData = analyzeVolume(candles);
    const liquidityData = analyzeLiquidity(candles, currentPrice);

    const { direction } = decideDirection(tech, ict);
    if (direction === 'NO_TRADE') {
      console.log(`[SIGNAL] No clear direction for ${symbol}`);
      return null;
    }

    if (!shouldGenerateSignal(symbol, direction)) return null;

    const { stopLoss, takeProfit, riskReward } = calculateRisk(direction, currentPrice, tech.atr);

    if (riskReward < SIGNAL_CONFIG.MIN_RR) return null;

    if (riskReward < SIGNAL_CONFIG.MIN_RR) return null;

    // --- Hybrid Confidence Model ---
    // Calculate initial quant confidence based strictly on math
    const breakdown = calculateConfidence(direction, tech, ict, riskReward, currentPrice, volumeData, liquidityData);
    const quantScore = breakdown.total;

    const minQuantConfidence = 60; // Lowered from 75 to allow AI to bump it up

    if (quantScore < minQuantConfidence) {
      console.log(`[SIGNAL] Quant score too low (${quantScore}) for ${symbol}`);
      return null;
    }

    let finalConfidence = quantScore;
    let geminiScore = 0;
    let riskFactorsArr: string[] = [];
    let geminiReasoning: string[] = [];
    
    // Call Gemini only if quant score is acceptable
    const geminiResponse = await analyzeWithGemini(
      symbol, 
      currentPrice,
      tech,
      ict.structures,
      volumeData || ({} as any),
      liquidityData || ({} as any)
    );

    if (geminiResponse) {
      geminiScore = geminiResponse.confidence;
      geminiReasoning = geminiResponse.reasoning;
      riskFactorsArr = geminiResponse.riskFactors;
      // Formula: 60% Quant + 40% AI
      finalConfidence = Math.round((quantScore * 0.6) + (geminiScore * 0.4));
      console.log(`[SIGNAL] Hybrid confidence: Quant ${quantScore} / AI ${geminiScore} -> Final: ${finalConfidence}`);
    } else {
      console.log(`[SIGNAL] Gemini unavailable, using Quant score: ${quantScore}`);
    }

    if (finalConfidence < SIGNAL_CONFIG.MIN_CONFIDENCE) {
       console.log(`[SIGNAL] Final confidence too low (${finalConfidence}) for ${symbol}`);
       return null;
    }

    // --- News Fusion ---
    const newsData = await processNewsForAsset(symbol);
    let newsExplanation = '';
    
    if (newsData && newsData.articles.length > 0) {
      if (newsData.hasConflict) {
        newsExplanation = '⚠️ CONFLICTING NEWS: Confidence reduced due to contradictory high-impact news events.';
        finalConfidence = Math.max(0, finalConfidence - 15);
      } else if (
        (direction === 'LONG' && newsData.signalEffect.includes('CONTRADICTS_BUY')) ||
        (direction === 'SHORT' && newsData.signalEffect.includes('CONTRADICTS_SELL'))
      ) {
        newsExplanation = `⚠️ NEWS CONTRADICTION: Technical setup is ${direction} but news bias is ${newsData.biasStatus} (${newsData.biasScore}).`;
        finalConfidence = Math.max(0, finalConfidence - 20); // Penalty
      } else if (
        (direction === 'LONG' && newsData.signalEffect.includes('SUPPORTS_BUY')) ||
        (direction === 'SHORT' && newsData.signalEffect.includes('SUPPORTS_SELL'))
      ) {
        newsExplanation = `🟢 NEWS SUPPORT: Technical setup is confirmed by ${newsData.biasStatus} news bias (${newsData.biasScore}).`;
        // Only bump if it's already a good signal
        if (finalConfidence >= 75) {
           finalConfidence = Math.min(100, finalConfidence + 5);
        }
      } else {
        newsExplanation = `⚪ NEUTRAL NEWS: News impact is minimal or mixed (${newsData.biasScore}).`;
      }
    } else {
      newsExplanation = `⚪ NO NEWS: No relevant recent news found for ${symbol}.`;
    }

    if (finalConfidence < SIGNAL_CONFIG.MIN_CONFIDENCE) {
       console.log(`[SIGNAL] Final confidence fell below threshold after News Bias (${finalConfidence}) for ${symbol}`);
       return null;
    }

    // Generate strict reasoning text (existing)
    const reasons = generateExplanation(direction, breakdown, volumeData, liquidityData, ict, riskReward);
    const { strategy, display } = selectStrategy(tech, ict);

    // Call the new Risk Engine
    const riskProfile = evaluateRisk({
      symbol,
      direction,
      entry: currentPrice,
      stopLoss,
      takeProfit,
      confidence: finalConfidence,
      technical: tech,
      volume: volumeData || ({} as any),
      liquidity: liquidityData || ({} as any),
      structure: ict.structures,
      geminiReasoning
    });

    const now = Date.now();
    const id = `${symbol.replace('/', '')}-${direction}-${now}`;

    const signal: TradingSignal = {
      id,
      symbol,
      timeframe: SIGNAL_CONFIG.TIMEFRAME,
      direction,
      entry: currentPrice,
      stopLoss,
      takeProfit,
      riskReward,
      confidence: finalConfidence,
      quantScore,
      geminiScore: geminiResponse ? geminiScore : undefined,
      confidenceBreakdown: breakdown,
      strategy: strategy as TradingSignal['strategy'],
      strategyDisplay: display,
      timestamp: now,
      status: 'ACTIVE',
      outcome: 'PENDING',
      reasons,
      geminiReasoning: geminiReasoning.length > 0 ? geminiReasoning : undefined,
      riskFactorsArr: riskFactorsArr.length > 0 ? riskFactorsArr : undefined,
      technicalFactors: tech,
      structureFactors: ict.structures.slice(-5),
      volumeAnalysis: volumeData ?? undefined,
      liquidityAnalysis: liquidityData ?? undefined,
      riskFactors: riskProfile,
      newsData: newsData ?? undefined,
      newsExplanation: newsExplanation || undefined,
      createdAt: now,
      updatedAt: now,
    };

    insertSignal(signal);
    logEvent('SIGNAL', `${direction} signal generated for ${symbol}`, { id, confidence: finalConfidence, quantScore, geminiScore });

    lastSignalTime.set(`${symbol}:${direction}`, now);
    dailySignalCount++;

    console.log(`[SIGNAL] ✅ ${symbol} ${direction} | Final Conf: ${finalConfidence}% | Quant: ${quantScore} | Gemini: ${geminiScore} | RR: ${riskReward.toFixed(2)}`);
    return signal;

  } catch (err) {
    console.error(`[SIGNAL] Error generating signal for ${symbol}:`, err);
    return null;
  }
}

// ─── Demo Signal ─────────────────────────────────────────────────────────────
export async function generateDemoSignal(symbol: string, forcedDirection?: 'LONG' | 'SHORT'): Promise<TradingSignal | null> {
  console.log(`[SIGNAL] Generating DEMO signal for ${symbol}...`);

  try {
    const [tick, candles] = await Promise.all([
      getLatestPrice(symbol),
      getOHLCV(symbol, SIGNAL_CONFIG.TIMEFRAME, 250),
    ]);

    if (!candles || candles.length < 200) return null;

    const currentPrice = tick.price;
    const tech = analyzeTechnicals(candles);
    if (!tech) return null;

    const ict = runICTAnalysis(candles);
    const volumeData = analyzeVolume(candles);
    const liquidityData = analyzeLiquidity(candles, currentPrice);

    const direction = forcedDirection ?? (tech.trend === 'BEARISH' ? 'SHORT' : 'LONG');
    const { stopLoss, takeProfit, riskReward } = calculateRisk(direction, currentPrice, tech.atr);
    const safeRR = Math.max(2.0, riskReward);
    const breakdown = calculateConfidence(direction, tech, ict, safeRR, currentPrice, volumeData, liquidityData);
    const quantScore = Math.max(80, breakdown.total);
    const reasons = generateExplanation(direction, breakdown, volumeData, liquidityData, ict, safeRR);
    const { strategy, display } = selectStrategy(tech, ict);

    const geminiResponse = await analyzeWithGemini(
      symbol, 
      currentPrice, 
      tech, 
      ict.structures, 
      volumeData || ({} as any), 
      liquidityData || ({} as any)
    );
    
    let geminiScore = quantScore; 
    let finalConfidence = quantScore;
    let geminiReasoning: string[] = [];
    let riskFactorsArr: string[] = [];

    if (geminiResponse) {
      geminiScore = geminiResponse.confidence;
      finalConfidence = Math.min(100, Math.round(0.60 * quantScore + 0.40 * geminiScore));
      geminiReasoning = geminiResponse.reasoning;
      riskFactorsArr = geminiResponse.riskFactors;
    }

    const now = Date.now();
    const id = `DEMO-${Date.now().toString(36).toUpperCase()}`;

    const riskProfile = evaluateRisk({
      symbol,
      direction,
      entry: currentPrice,
      stopLoss,
      takeProfit,
      confidence: finalConfidence,
      technical: tech,
      volume: volumeData || ({} as any),
      liquidity: liquidityData || ({} as any),
      structure: ict.structures,
      geminiReasoning
    });

      const signal: TradingSignal = {
      id,
      symbol,
      timeframe: SIGNAL_CONFIG.TIMEFRAME,
      direction,
      entry: currentPrice,
      stopLoss,
      takeProfit,
      riskReward: safeRR,
      confidence: finalConfidence,
      quantScore: quantScore,
      geminiScore: geminiResponse ? geminiScore : undefined,
      confidenceBreakdown: { ...breakdown, total: quantScore, level: 'HIGH' },
      strategy: strategy as TradingSignal['strategy'],
      strategyDisplay: `[DEMO] ${display}`,
      timestamp: now,
      status: 'ACTIVE',
      outcome: 'PENDING',
      reasons,
      geminiReasoning: geminiReasoning.length > 0 ? geminiReasoning : undefined,
      riskFactorsArr: riskFactorsArr.length > 0 ? riskFactorsArr : undefined,
      technicalFactors: tech,
      structureFactors: ict.structures.slice(-5),
      volumeAnalysis: volumeData ?? undefined,
      liquidityAnalysis: liquidityData ?? undefined,
      riskFactors: riskProfile,
      newsData: {
        symbol,
        biasScore: direction === 'LONG' ? 45 : -45,
        biasStatus: direction === 'LONG' ? 'BULLISH' : 'BEARISH',
        impact: 'HIGH',
        confidence: 85,
        newsCount: 3,
        bullishNewsCount: direction === 'LONG' ? 3 : 0,
        bearishNewsCount: direction === 'SHORT' ? 3 : 0,
        neutralNewsCount: 0,
        hasConflict: false,
        signalEffect: direction === 'LONG' ? 'SUPPORTS_BUY' : 'SUPPORTS_SELL',
        lastUpdated: now,
        articles: [
          {
            id: 'demo-article',
            title: `Breaking: Institutional Adoption of ${symbol.split('/')[0]} Reaches All-Time High`,
            description: 'Major financial institutions are accumulating massive amounts, leading to extreme buying pressure.',
            url: '#',
            source: 'Demo News Network',
            publishedAt: now - 600000,
            fetchedAt: now,
            assets: [symbol.split('/')[0]],
            status: 'ANALYZED',
            analysis: {
              asset: symbol.split('/')[0],
              sentiment: direction === 'LONG' ? 'BULLISH' : 'BEARISH',
              sentimentScore: direction === 'LONG' ? 80 : -80,
              impact: 'HIGH',
              impactScore: 8,
              confidence: 90,
              timeHorizon: 'SHORT_TERM',
              bias: direction === 'LONG' ? 'BULLISH' : 'BEARISH',
              biasScore: direction === 'LONG' ? 45 : -45,
              marketRelevance: 9,
              signalEffect: direction === 'LONG' ? 'SUPPORTS_BUY' : 'SUPPORTS_SELL',
              reason: 'Institutional buying typically leads to strong upward momentum.'
            }
          }
        ]
      },
      newsExplanation: direction === 'LONG' ? 'News Strongly SUPPORTS BUY condition.' : 'News Strongly SUPPORTS SELL condition.',
      createdAt: now,
      updatedAt: now,
    };

    insertSignal(signal);
    return signal;

  } catch (err) {
    console.error(`[SIGNAL] Demo signal error:`, err);
    return null;
  }
}

// ─── Outcome Tracking ─────────────────────────────────────────────────────────
export async function checkSignalOutcomes(signals: TradingSignal[]): Promise<void> {
  for (const signal of signals) {
    if (signal.status !== 'ACTIVE') continue;

    try {
      const tick = await getLatestPrice(signal.symbol);
      const price = tick.price;

      if (signal.direction === 'LONG') {
        if (price >= signal.takeProfit) return;
        if (price <= signal.stopLoss) return;
      } else {
        if (price <= signal.takeProfit) return;
        if (price >= signal.stopLoss) return;
      }
    } catch { }
  }
}

export { SIGNAL_CONFIG };
