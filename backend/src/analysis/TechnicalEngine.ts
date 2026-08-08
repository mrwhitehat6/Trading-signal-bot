import type { OHLCVCandle, TechnicalIndicators } from '../types';

// ─── EMA ─────────────────────────────────────────────────────────────────────
export function calculateEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema.push(sum / period);

  for (let i = period; i < closes.length; i++) {
    ema.push((closes[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }
  return ema;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────
export function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length <= period) return [];

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  const rsi: number[] = [];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}

// ─── MACD ─────────────────────────────────────────────────────────────────────
export function calculateMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const offset = slow - fast;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }

  const signalLine = calculateEMA(macdLine, signal);
  const histogram: number[] = [];
  const sigOffset = macdLine.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + sigOffset] - signalLine[i]);
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

// ─── ATR ─────────────────────────────────────────────────────────────────────
export function calculateATR(candles: OHLCVCandle[], period = 14): number[] {
  if (candles.length <= period) return [];

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  const atr: number[] = [];
  let avgTR = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atr.push(avgTR);

  for (let i = period; i < trs.length; i++) {
    avgTR = (avgTR * (period - 1) + trs[i]) / period;
    atr.push(avgTR);
  }

  return atr;
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────
export function calculateVWAP(candles: OHLCVCandle[]): number {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativeTPV += typicalPrice * c.volume;
    cumulativeVolume += c.volume;
  }

  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
}

// ─── Volume Average ───────────────────────────────────────────────────────────
export function calculateVolumeAverage(candles: OHLCVCandle[], period = 20): number {
  if (candles.length < period) return 0;
  const recent = candles.slice(-period);
  return recent.reduce((sum, c) => sum + c.volume, 0) / period;
}

// ─── Trend Detection ──────────────────────────────────────────────────────────
function detectTrend(
  price: number,
  ema20: number,
  ema50: number,
  ema200: number
): 'BULLISH' | 'BEARISH' | 'SIDEWAYS' {
  const bullish = price > ema200 && ema20 > ema50;
  const bearish = price < ema200 && ema20 < ema50;
  if (bullish) return 'BULLISH';
  if (bearish) return 'BEARISH';
  return 'SIDEWAYS';
}

// ─── Volatility ───────────────────────────────────────────────────────────────
function detectVolatility(atr: number, price: number): 'LOW' | 'NORMAL' | 'HIGH' {
  const atrPct = (atr / price) * 100;
  if (atrPct < 0.5) return 'LOW';
  if (atrPct > 2.0) return 'HIGH';
  return 'NORMAL';
}

// ─── Main Technical Analysis ──────────────────────────────────────────────────
export function analyzeTechnicals(candles: OHLCVCandle[]): TechnicalIndicators | null {
  if (candles.length < 200) {
    console.warn('[TECHNICAL] Insufficient candles for analysis');
    return null;
  }

  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];

  const ema9All = calculateEMA(closes, 9);
  const ema20All = calculateEMA(closes, 20);
  const ema50All = calculateEMA(closes, 50);
  const ema200All = calculateEMA(closes, 200);

  const rsiAll = calculateRSI(closes, 14);
  const { macd, signal, histogram } = calculateMACD(closes);
  const atrAll = calculateATR(candles, 14);

  const ema9 = ema9All[ema9All.length - 1] ?? currentPrice;
  const ema20 = ema20All[ema20All.length - 1] ?? currentPrice;
  const ema50 = ema50All[ema50All.length - 1] ?? currentPrice;
  const ema200 = ema200All[ema200All.length - 1] ?? currentPrice;
  const rsi = rsiAll[rsiAll.length - 1] ?? 50;
  const macdVal = macd[macd.length - 1] ?? 0;
  const macdSignal = signal[signal.length - 1] ?? 0;
  const macdHist = histogram[histogram.length - 1] ?? 0;
  const atr = atrAll[atrAll.length - 1] ?? 0;
  const vwap = calculateVWAP(candles.slice(-96)); // ~1 day of 15m candles
  const volumeAvg = calculateVolumeAverage(candles, 20);
  const currentVolume = candles[candles.length - 1].volume;
  const volumeRatio = volumeAvg > 0 ? currentVolume / volumeAvg : 1;

  return {
    ema9,
    ema20,
    ema50,
    ema200,
    rsi,
    macd: macdVal,
    macdSignal,
    macdHist,
    atr,
    vwap,
    volumeAvg,
    volumeRatio,
    trend: detectTrend(currentPrice, ema20, ema50, ema200),
    volatility: detectVolatility(atr, currentPrice),
  };
}
