import type { 
  TechnicalIndicators, MarketStructure, VolumeAnalysis, LiquidityAnalysis, RiskProfile 
} from '../types';

interface RiskEngineInput {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  technical: TechnicalIndicators;
  volume: VolumeAnalysis;
  liquidity: LiquidityAnalysis;
  structure: MarketStructure[];
  geminiReasoning?: string[];
}

// Configurable account settings
const RISK_SETTINGS = {
  DEFAULT_ACCOUNT_BALANCE: 100000,
  DEFAULT_RISK_PERCENT: 1.0,
  MAX_ALLOWED_DRAWDOWN: 5.0,
  MIN_RISK_REWARD: 1.5,
  MIN_CONFIDENCE_SCORE: 70
};

/**
 * Deterministically evaluates market conditions against strict safety thresholds
 */
export function evaluateRisk(input: RiskEngineInput): RiskProfile {
  // 1. Calculate base capital risk and position sizing
  const accountBalance = RISK_SETTINGS.DEFAULT_ACCOUNT_BALANCE;
  const riskPercent = RISK_SETTINGS.DEFAULT_RISK_PERCENT;
  const riskAmount = (accountBalance * riskPercent) / 100;
  
  const priceDistance = Math.abs(input.entry - input.stopLoss);
  // Position size = Risk Amount / Absolute(Entry - Stop Loss)
  const positionSize = priceDistance > 0 ? riskAmount / priceDistance : 0;

  // 2. Risk/Reward calculation
  const riskPoints = Math.abs(input.entry - input.stopLoss);
  const rewardPoints = Math.abs(input.takeProfit - input.entry);
  const riskReward = riskPoints > 0 ? rewardPoints / riskPoints : 0;

  // 3. Volatility Assessment
  const atrPercent = (input.technical.atr / input.entry) * 100;
  let volLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'LOW';
  if (atrPercent > 3.0) volLevel = 'EXTREME';
  else if (atrPercent > 1.5) volLevel = 'HIGH';
  else if (atrPercent > 0.5) volLevel = 'MODERATE';

  // 4. Liquidity Assessment
  const spreadPercent = 0.01; // Mocking spread for now if orderbook is missing
  let liqLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'HIGH';
  if (input.volume.volumeState === 'LOW') liqLevel = 'MODERATE';
  if (input.volume.rvol < 0.5) liqLevel = 'LOW';

  // 5. Structure & Factor mapping
  const marketStructure = input.technical.trend;
  const volumeFactor = input.volume.volumeState;
  const momentumFactor = input.technical.macdHist > 0 ? 'POSITIVE' : 'NEGATIVE';

  // 6. Hard Risk Checks
  const checks = {
    riskReward: riskReward >= RISK_SETTINGS.MIN_RISK_REWARD,
    stopLoss: priceDistance > 0 && atrPercent < 5.0,
    positionSize: positionSize > 0 && positionSize * input.entry <= accountBalance * 2,
    liquidity: liqLevel !== 'LOW',
    volatility: volLevel !== 'EXTREME',
    confidence: input.confidence >= RISK_SETTINGS.MIN_CONFIDENCE_SCORE,
    drawdown: true // Always true for now unless we implement live equity curve
  };

  // 7. Aggregate warnings
  const warnings: string[] = [];
  if (!checks.riskReward) warnings.push(`⚠ Risk/reward ratio (${riskReward.toFixed(2)}) is below minimum threshold (${RISK_SETTINGS.MIN_RISK_REWARD})`);
  if (!checks.stopLoss) warnings.push(`⚠ Stop-loss distance is extreme or invalid`);
  if (!checks.positionSize) warnings.push(`⚠ Position size exceeds leverage limits`);
  if (!checks.liquidity) warnings.push(`⚠ Low liquidity / volume detected`);
  if (!checks.volatility) warnings.push(`⚠ Volatility is EXTREME (${atrPercent.toFixed(2)}%)`);
  if (!checks.confidence) warnings.push(`⚠ Signal confidence (${input.confidence}%) is below preferred threshold`);

  // 8. Final Decision Logic
  let decision: 'APPROVED' | 'REJECTED' | 'CAUTION' = 'APPROVED';
  
  const allChecksPass = Object.values(checks).every(c => c === true);
  
  if (process.env.DEMO_MODE === 'true') {
    decision = 'APPROVED'; // Always approve for demo pipeline demonstration
  } else if (!allChecksPass) {
    decision = 'REJECTED';
  } else if (warnings.length > 0) {
    decision = 'CAUTION';
  }

  // Calculate generic score out of 100 based on warnings
  let riskScore = 10;
  if (decision === 'REJECTED') riskScore += 60;
  if (volLevel === 'HIGH') riskScore += 20;
  if (liqLevel === 'MODERATE') riskScore += 10;

  // Bound it
  riskScore = Math.min(100, Math.max(0, riskScore));

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
  if (riskScore > 80) riskLevel = 'EXTREME';
  else if (riskScore > 60) riskLevel = 'HIGH';
  else if (riskScore > 30) riskLevel = 'MEDIUM';

  const aiExplanation = input.geminiReasoning && input.geminiReasoning.length > 0
    ? input.geminiReasoning.join(' ')
    : 'Waiting for AI analysis...';

  return {
    riskScore,
    riskLevel,
    decision,
    riskReward,
    accountBalance,
    riskPercent,
    riskAmount,
    positionSize,
    volatility: {
      level: volLevel,
      atr: input.technical.atr,
      atrPercent
    },
    liquidity: {
      level: liqLevel,
      volume24h: input.volume.currentVolume * 1000, // Roughly scaled
      spreadPercent
    },
    factors: {
      marketStructure,
      volume: volumeFactor,
      momentum: momentumFactor,
      trend: input.technical.trend
    },
    checks,
    warnings,
    aiExplanation
  };
}
