import type { TechnicalIndicators, ConfidenceBreakdown, VolumeAnalysis, LiquidityAnalysis } from '../types';
import type { ICTAnalysis } from '../analysis/ICTEngine';

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  MIN_TRADE: 75,
  MEDIUM: 70,
  HIGH: 80,
  VERY_HIGH: 90,
};

export function calculateConfidence(
  direction: 'LONG' | 'SHORT',
  tech: TechnicalIndicators,
  ict: ICTAnalysis,
  riskReward: number,
  currentPrice: number,
  volumeData: VolumeAnalysis | null,
  liquidityData: LiquidityAnalysis | null
): ConfidenceBreakdown {

  let structure = 0;   // 20
  let liquidity = 0;   // 20
  let volume = 0;      // 15
  let momentum = 0;    // 15
  let ictScore = 0;    // 20
  let risk = 0;        // 10
  
  // Volume evaluation
  if (volumeData) {
    if (volumeData.rvol >= 1.75) volume += 15;
    else if (volumeData.rvol >= 1.25) volume += 10;
    else if (volumeData.rvol >= 0.75) volume += 5;

    if (volumeData.volumeTrend === 'INCREASING') volume = Math.min(15, volume + 2);
  }

  if (direction === 'LONG') {
    // Structure (max 20)
    if (ict.hasBullishMSS) structure += 10;
    if (ict.hasBullishBOS) structure += 10;
    const recentBullish = ict.structures.filter(s => s.direction === 'BULLISH').length;
    if (recentBullish > 2 && structure < 20) structure = Math.min(20, structure + 5);

    // Liquidity (max 20)
    if (liquidityData) {
      if (liquidityData.sweeps.some(s => s.type === 'SELL-SIDE SWEEP')) liquidity += 15;
      if (liquidityData.nearestPool === 'BSL') liquidity += 5; // Price drawn to BSL
    } else {
      if (ict.hasBullishSweep) liquidity += 15;
      if (ict.pdZone.zone === 'DISCOUNT') liquidity += 5;
    }

    // Momentum (max 15)
    if (tech.rsi > 50 && tech.rsi < 70) momentum += 10;
    if (tech.macdHist > 0) momentum += 5;

    // ICT (max 20)
    if (ict.hasBullishFVG) ictScore += 10;
    if (ict.hasBullishOB) ictScore += 10;

    // Risk (max 10)
    if (riskReward >= 3) risk = 10;
    else if (riskReward >= 2) risk = 8;
    else if (riskReward >= 1.5) risk = 5;

  } else { // SHORT
    // Structure (max 20)
    if (ict.hasBearishMSS) structure += 10;
    if (ict.hasBearishBOS) structure += 10;
    const recentBearish = ict.structures.filter(s => s.direction === 'BEARISH').length;
    if (recentBearish > 2 && structure < 20) structure = Math.min(20, structure + 5);

    // Liquidity (max 20)
    if (liquidityData) {
      if (liquidityData.sweeps.some(s => s.type === 'BUY-SIDE SWEEP')) liquidity += 15;
      if (liquidityData.nearestPool === 'SSL') liquidity += 5; // Price drawn to SSL
    } else {
      if (ict.hasBearishSweep) liquidity += 15;
      if (ict.pdZone.zone === 'PREMIUM') liquidity += 5;
    }

    // Momentum (max 15)
    if (tech.rsi < 50 && tech.rsi > 30) momentum += 10;
    if (tech.macdHist < 0) momentum += 5;

    // ICT (max 20)
    if (ict.hasBearishFVG) ictScore += 10;
    if (ict.hasBearishOB) ictScore += 10;

    // Risk (max 10)
    if (riskReward >= 3) risk = 10;
    else if (riskReward >= 2) risk = 8;
    else if (riskReward >= 1.5) risk = 5;
  }

  const total = Math.min(100, structure + liquidity + volume + momentum + ictScore + risk);

  let level: ConfidenceBreakdown['level'] = 'LOW';
  if (total >= CONFIDENCE_THRESHOLDS.VERY_HIGH) level = 'VERY_HIGH';
  else if (total >= CONFIDENCE_THRESHOLDS.HIGH) level = 'HIGH';
  else if (total >= CONFIDENCE_THRESHOLDS.MEDIUM) level = 'MEDIUM';

  return {
    technical: 0, // Migrated into momentum mostly, but kept for type compat
    structure,
    momentum,
    volume,
    liquidity,
    ict: ictScore,
    risk,
    total,
    level,
  };
}

export function generateExplanation(
  direction: 'LONG' | 'SHORT',
  bd: ConfidenceBreakdown,
  volumeData: VolumeAnalysis | null,
  liquidityData: LiquidityAnalysis | null,
  ict: ICTAnalysis,
  riskReward: number
): string[] {
  const reasons: string[] = [];

  if (direction === 'LONG') {
    if (liquidityData?.sweeps.some(s => s.type === 'SELL-SIDE SWEEP') || ict.hasBullishSweep) {
      reasons.push('✓ Sell-side liquidity swept');
    }
    if (ict.hasBullishMSS) reasons.push('✓ Bullish MSS confirmed');
    if (ict.hasBullishBOS) reasons.push('✓ Bullish BOS detected');
    if (volumeData && volumeData.rvol >= 1.25) reasons.push(`✓ High RVOL = ${volumeData.rvol.toFixed(2)}x`);
    if (ict.hasBullishFVG) reasons.push('✓ Bullish FVG confirmation');
    if (ict.hasBullishOB) reasons.push('✓ Bullish Order Block');
    if (riskReward >= 2) reasons.push(`✓ R:R = 1:${riskReward.toFixed(1)}`);
  } else {
    if (liquidityData?.sweeps.some(s => s.type === 'BUY-SIDE SWEEP') || ict.hasBearishSweep) {
      reasons.push('✓ Buy-side liquidity swept');
    }
    if (ict.hasBearishMSS) reasons.push('✓ Bearish MSS confirmed');
    if (ict.hasBearishBOS) reasons.push('✓ Bearish BOS detected');
    if (volumeData && volumeData.rvol >= 1.25) reasons.push(`✓ High RVOL = ${volumeData.rvol.toFixed(2)}x`);
    if (ict.hasBearishFVG) reasons.push('✓ Bearish FVG confirmation');
    if (ict.hasBearishOB) reasons.push('✓ Bearish Order Block');
    if (riskReward >= 2) reasons.push(`✓ R:R = 1:${riskReward.toFixed(1)}`);
  }

  if (reasons.length === 0) {
    reasons.push('Insufficient confirmation across metrics.');
  }

  return reasons;
}
