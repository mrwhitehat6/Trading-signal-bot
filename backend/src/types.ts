// Market Data Types
export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketTick {
  symbol: string;
  price: number;
  change24h: number;
  changePct24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface MarketStatus {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'RECONNECTING' | 'LIVE';
  lastUpdate: number;
  provider: string;
}

export interface VolumeAnalysis {
  currentVolume: number;
  averageVolume: number;
  rvol: number;
  volumeState: 'LOW' | 'NORMAL' | 'HIGH' | 'VERY HIGH';
  volumeSpike: boolean;
  volumeTrend: 'INCREASING' | 'DECREASING' | 'FLAT';
  timestamp: number;
}

export interface LiquidityZone {
  type: 'BSL' | 'SSL' | 'EQH' | 'EQL';
  price: number;
  distanceFromPrice: number;
  strength: number;
  source: string;
  timestamp: number;
}

export interface LiquiditySweep {
  detected: boolean;
  type: 'BUY-SIDE SWEEP' | 'SELL-SIDE SWEEP';
  liquidityLevel: number;
  sweepPrice: number;
  confirmationCandle: number;
  timestamp: number;
  confidence: number;
}

export interface LiquidityAnalysis {
  bsl: LiquidityZone[];
  ssl: LiquidityZone[];
  eqh: LiquidityZone[];
  eql: LiquidityZone[];
  sweeps: LiquiditySweep[];
  nearestPool: 'BSL' | 'SSL' | null;
}

// Technical Analysis Types
export interface TechnicalIndicators {
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  atr: number;
  vwap: number;
  volumeAvg: number;
  volumeRatio: number;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  volatility: 'LOW' | 'NORMAL' | 'HIGH';
}

// ICT/SMC Types
export type StructureType = 'BOS' | 'CHOCH' | 'MSS' | 'HH' | 'HL' | 'LH' | 'LL' | 'EQH' | 'EQL' | 'FVG' | 'OB' | 'LIQUIDITY_SWEEP' | 'DISPLACEMENT';

export interface MarketStructure {
  type: StructureType;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  price: number;
  timestamp: number;
  strength: number;  // 0-100
  confirmed: boolean;
}

export interface FairValueGap {
  top: number;
  bottom: number;
  midpoint: number;
  direction: 'BULLISH' | 'BEARISH';
  timestamp: number;
  filled: boolean;
}

export interface OrderBlock {
  top: number;
  bottom: number;
  direction: 'BULLISH' | 'BEARISH';
  timestamp: number;
  tested: boolean;
  strength: number;
}

export interface SwingPoint {
  type: 'HIGH' | 'LOW';
  price: number;
  timestamp: number;
  index: number;
}

// Signal Types
export type SignalDirection = 'LONG' | 'SHORT' | 'NO_TRADE';
export type SignalStatus = 'ACTIVE' | 'TP_HIT' | 'SL_HIT' | 'EXPIRED' | 'CANCELLED';
export type SignalOutcome = 'WIN' | 'LOSS' | 'PENDING' | 'CANCELLED';
export type StrategyName = 'TREND_FOLLOWING' | 'EMA_RSI' | 'VWAP_MOMENTUM' | 'ICT_SMC' | 'LIQUIDITY_SWEEP' | 'BREAKOUT' | 'MEAN_REVERSION';

export interface ConfidenceBreakdown {
  technical: number;     // /20
  structure: number;     // /20
  momentum: number;      // /15
  volume: number;        // /10
  liquidity: number;     // /10
  ict: number;           // /15
  risk: number;          // /10
  total: number;         // /100
  level: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiskProfile {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  decision: 'APPROVED' | 'REJECTED' | 'CAUTION';
  riskReward: number;
  accountBalance: number;
  riskPercent: number;
  riskAmount: number;
  positionSize: number;
  volatility: {
    level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    atr: number;
    atrPercent: number;
  };
  liquidity: {
    level: 'LOW' | 'MODERATE' | 'HIGH';
    volume24h: number;
    spreadPercent: number;
  };
  factors: {
    marketStructure: string;
    volume: string;
    momentum: string;
    trend: string;
  };
  checks: {
    riskReward: boolean;
    stopLoss: boolean;
    positionSize: boolean;
    liquidity: boolean;
    volatility: boolean;
    confidence: boolean;
    drawdown: boolean;
  };
  warnings: string[];
  aiExplanation: string;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: SignalDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number; // This will now be finalConfidence
  quantScore: number;
  geminiScore?: number;
  confidenceBreakdown: ConfidenceBreakdown;
  strategy: StrategyName;
  strategyDisplay: string;
  timestamp: number;
  status: SignalStatus;
  outcome: SignalOutcome;
  reasons: string[];
  geminiReasoning?: string[];
  riskFactorsArr?: string[];
  technicalFactors: TechnicalIndicators;
  structureFactors: MarketStructure[];
  volumeAnalysis?: VolumeAnalysis;
  liquidityAnalysis?: LiquidityAnalysis;
  riskFactors: RiskProfile;
  // Blockchain
  algorandAppId?: number;
  algorandTxId?: string;
  algorandTimestamp?: number;
  // AI explanation
  aiExplanation?: string;
  // News Integration
  newsData?: NewsBiasData;
  newsExplanation?: string;
  createdAt: number;
  updatedAt: number;
}

// Performance Stats
export interface PerformanceStats {
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  profitFactor: number;
  avgConfidence: number;
  signalsToday: number;
  activeSignals: number;
  bestStrategy: string;
  byStrategy: Record<string, { signals: number; wins: number; losses: number; winRate: number }>;
}

// SSE Event Types
export interface SSEEvent {
  type: 'SIGNAL' | 'PRICE_UPDATE' | 'STATUS_UPDATE' | 'PERFORMANCE' | 'HEALTH' | 'SYSTEM' | 'MARKET_STATUS' | 'MARKET_INTELLIGENCE' | 'LIVE_PROGRESS';
  data: unknown;
  timestamp: number;
}

// ─── News Data Models ────────────────────────────────────────────────────────
export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: number;
  fetchedAt: number;
  imageUrl?: string;
  assets: string[];
  category?: string;
  language?: string;
}

export type NewsSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type NewsImpact = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NewsTimeHorizon = 'INTRADAY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
export type NewsSignalEffect = 'SUPPORTS_BUY' | 'SUPPORTS_SELL' | 'CONTRADICTS_BUY' | 'CONTRADICTS_SELL' | 'NEUTRAL';

export interface GeminiNewsAnalysis {
  asset: string;
  sentiment: NewsSentiment;
  sentimentScore: number;
  impact: NewsImpact;
  impactScore: number;
  confidence: number;
  timeHorizon: NewsTimeHorizon;
  bias: NewsSentiment;
  biasScore: number;
  marketRelevance: number;
  signalEffect: NewsSignalEffect;
  reason: string;
}

export interface AnalyzedNewsArticle extends NewsArticle {
  analysis?: GeminiNewsAnalysis;
  status: 'PENDING' | 'ANALYZED' | 'FAILED';
}

export interface NewsBiasData {
  symbol: string;
  biasScore: number;
  biasStatus: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  impact: NewsImpact;
  confidence: number;
  newsCount: number;
  bullishNewsCount: number;
  bearishNewsCount: number;
  neutralNewsCount: number;
  articles: AnalyzedNewsArticle[];
  hasConflict: boolean;
  signalEffect: NewsSignalEffect;
  lastUpdated: number;
}

