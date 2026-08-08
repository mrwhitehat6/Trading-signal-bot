import type { OHLCVCandle, MarketStructure, FairValueGap, OrderBlock, SwingPoint } from '../types';

// ─── Swing Point Detection ────────────────────────────────────────────────────
export function detectSwingPoints(candles: OHLCVCandle[], lookback = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isSwingHigh = false;
      if (candles[j].low <= c.low) isSwingLow = false;
    }

    if (isSwingHigh) {
      swings.push({ type: 'HIGH', price: c.high, timestamp: c.timestamp, index: i });
    }
    if (isSwingLow) {
      swings.push({ type: 'LOW', price: c.low, timestamp: c.timestamp, index: i });
    }
  }

  return swings.sort((a, b) => a.index - b.index);
}

// ─── Market Structure (HH, HL, LH, LL) ───────────────────────────────────────
export function classifySwings(swings: SwingPoint[]): MarketStructure[] {
  const structures: MarketStructure[] = [];

  const highs = swings.filter(s => s.type === 'HIGH');
  const lows = swings.filter(s => s.type === 'LOW');

  // Classify highs
  for (let i = 1; i < highs.length; i++) {
    const prev = highs[i - 1];
    const curr = highs[i];
    if (curr.price > prev.price) {
      structures.push({
        type: 'HH',
        direction: 'BULLISH',
        price: curr.price,
        timestamp: curr.timestamp,
        strength: Math.min(100, ((curr.price - prev.price) / prev.price) * 1000),
        confirmed: true,
      });
    } else if (curr.price < prev.price) {
      structures.push({
        type: 'LH',
        direction: 'BEARISH',
        price: curr.price,
        timestamp: curr.timestamp,
        strength: Math.min(100, ((prev.price - curr.price) / prev.price) * 1000),
        confirmed: true,
      });
    }
  }

  // Classify lows
  for (let i = 1; i < lows.length; i++) {
    const prev = lows[i - 1];
    const curr = lows[i];
    if (curr.price > prev.price) {
      structures.push({
        type: 'HL',
        direction: 'BULLISH',
        price: curr.price,
        timestamp: curr.timestamp,
        strength: Math.min(100, ((curr.price - prev.price) / prev.price) * 1000),
        confirmed: true,
      });
    } else if (curr.price < prev.price) {
      structures.push({
        type: 'LL',
        direction: 'BEARISH',
        price: curr.price,
        timestamp: curr.timestamp,
        strength: Math.min(100, ((prev.price - curr.price) / prev.price) * 1000),
        confirmed: true,
      });
    }
  }

  return structures.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── BOS / CHOCH Detection ────────────────────────────────────────────────────
export function detectBOSandCHOCH(
  candles: OHLCVCandle[],
  swings: SwingPoint[]
): MarketStructure[] {
  const structures: MarketStructure[] = [];
  const currentPrice = candles[candles.length - 1].close;

  const highs = swings.filter(s => s.type === 'HIGH').slice(-5);
  const lows = swings.filter(s => s.type === 'LOW').slice(-5);

  if (highs.length >= 2) {
    const prevHigh = highs[highs.length - 2];
    const lastHigh = highs[highs.length - 1];
    const lastCandles = candles.slice(lastHigh.index);

    // BOS: price breaks above a significant high
    if (currentPrice > prevHigh.price && currentPrice > lastHigh.price) {
      structures.push({
        type: 'BOS',
        direction: 'BULLISH',
        price: prevHigh.price,
        timestamp: Date.now(),
        strength: Math.min(100, ((currentPrice - prevHigh.price) / prevHigh.price) * 1000),
        confirmed: true,
      });
    }

    // MSS: bearish high followed by price breaking previous low
    const prevLow = lows.length > 0 ? lows[lows.length - 1] : null;
    if (prevLow && currentPrice < prevLow.price) {
      structures.push({
        type: 'MSS',
        direction: 'BEARISH',
        price: prevLow.price,
        timestamp: Date.now(),
        strength: Math.min(100, ((prevLow.price - currentPrice) / prevLow.price) * 1000),
        confirmed: true,
      });
    }
  }

  if (lows.length >= 2) {
    const prevLow = lows[lows.length - 2];
    const lastLow = lows[lows.length - 1];

    // BOS: price breaks below a significant low
    if (currentPrice < prevLow.price && currentPrice < lastLow.price) {
      structures.push({
        type: 'BOS',
        direction: 'BEARISH',
        price: prevLow.price,
        timestamp: Date.now(),
        strength: Math.min(100, ((prevLow.price - currentPrice) / prevLow.price) * 1000),
        confirmed: true,
      });
    }

    // MSS: bullish low break
    const prevHigh = highs.length > 0 ? highs[highs.length - 1] : null;
    if (prevHigh && currentPrice > prevHigh.price) {
      structures.push({
        type: 'MSS',
        direction: 'BULLISH',
        price: prevHigh.price,
        timestamp: Date.now(),
        strength: Math.min(100, ((currentPrice - prevHigh.price) / prevHigh.price) * 1000),
        confirmed: true,
      });
    }
  }

  return structures;
}

// ─── Fair Value Gap (FVG) Detection ──────────────────────────────────────────
export function detectFVGs(candles: OHLCVCandle[], lookback = 50): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const recent = candles.slice(-lookback);
  const currentPrice = candles[candles.length - 1].close;

  for (let i = 1; i < recent.length - 1; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const next = recent[i + 1];

    // Bullish FVG: gap between prev high and next low (gap up)
    if (next.low > prev.high) {
      const gap: FairValueGap = {
        top: next.low,
        bottom: prev.high,
        midpoint: (next.low + prev.high) / 2,
        direction: 'BULLISH',
        timestamp: curr.timestamp,
        filled: currentPrice <= next.low,
      };
      fvgs.push(gap);
    }

    // Bearish FVG: gap between prev low and next high (gap down)
    if (next.high < prev.low) {
      const gap: FairValueGap = {
        top: prev.low,
        bottom: next.high,
        midpoint: (prev.low + next.high) / 2,
        direction: 'BEARISH',
        timestamp: curr.timestamp,
        filled: currentPrice >= next.high,
      };
      fvgs.push(gap);
    }
  }

  return fvgs.slice(-10); // Return most recent FVGs
}

// ─── Order Block Detection ────────────────────────────────────────────────────
export function detectOrderBlocks(candles: OHLCVCandle[], lookback = 50): OrderBlock[] {
  const obs: OrderBlock[] = [];
  const recent = candles.slice(-lookback);
  const currentPrice = candles[candles.length - 1].close;

  for (let i = 1; i < recent.length - 1; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const next = recent[i + 1];

    const momentum = Math.abs(next.close - curr.close) / curr.close;

    // Bullish OB: last bearish candle before a strong bullish move
    if (
      curr.close < curr.open && // bearish candle
      next.close > next.open && // followed by bullish
      momentum > 0.003
    ) {
      obs.push({
        top: curr.open,
        bottom: curr.low,
        direction: 'BULLISH',
        timestamp: curr.timestamp,
        tested: currentPrice <= curr.open,
        strength: Math.min(100, momentum * 10000),
      });
    }

    // Bearish OB: last bullish candle before a strong bearish move
    if (
      curr.close > curr.open && // bullish candle
      next.close < next.open && // followed by bearish
      momentum > 0.003
    ) {
      obs.push({
        top: curr.high,
        bottom: curr.open,
        direction: 'BEARISH',
        timestamp: curr.timestamp,
        tested: currentPrice >= curr.open,
        strength: Math.min(100, momentum * 10000),
      });
    }
  }

  return obs.slice(-5);
}

// ─── Liquidity Sweep Detection ────────────────────────────────────────────────
export function detectLiquiditySweep(
  candles: OHLCVCandle[],
  swings: SwingPoint[]
): MarketStructure[] {
  const structures: MarketStructure[] = [];
  const recent = candles.slice(-20);
  const currentCandle = recent[recent.length - 1];

  // Look for equal highs/lows (liquidity zones)
  const recentHighs = swings.filter(s => s.type === 'HIGH').slice(-5);
  const recentLows = swings.filter(s => s.type === 'LOW').slice(-5);

  // Bullish sweep: price dipped below a recent low and recovered
  for (const low of recentLows) {
    const wick = currentCandle.low;
    const recovery = currentCandle.close;
    if (wick < low.price && recovery > low.price) {
      structures.push({
        type: 'LIQUIDITY_SWEEP',
        direction: 'BULLISH',
        price: low.price,
        timestamp: currentCandle.timestamp,
        strength: Math.min(100, ((recovery - wick) / wick) * 500),
        confirmed: true,
      });
      break;
    }
  }

  // Bearish sweep: price pierced above a recent high and reversed
  for (const high of recentHighs) {
    const wick = currentCandle.high;
    const drop = currentCandle.close;
    if (wick > high.price && drop < high.price) {
      structures.push({
        type: 'LIQUIDITY_SWEEP',
        direction: 'BEARISH',
        price: high.price,
        timestamp: currentCandle.timestamp,
        strength: Math.min(100, ((wick - drop) / drop) * 500),
        confirmed: true,
      });
      break;
    }
  }

  return structures;
}

// ─── Premium / Discount Zones ─────────────────────────────────────────────────
export function getPremiumDiscountZone(
  candles: OHLCVCandle[],
  lookback = 50
): { premium: number; discount: number; equilibrium: number; zone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' } {
  const recent = candles.slice(-lookback);
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const equilibrium = (high + low) / 2;
  const currentPrice = candles[candles.length - 1].close;
  const premium = (high + equilibrium) / 2;
  const discount = (low + equilibrium) / 2;

  let zone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
  if (currentPrice > premium) zone = 'PREMIUM';
  else if (currentPrice < discount) zone = 'DISCOUNT';

  return { premium, discount, equilibrium, zone };
}

// ─── Full ICT Analysis ────────────────────────────────────────────────────────
export interface ICTAnalysis {
  swings: SwingPoint[];
  structures: MarketStructure[];
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  liquiditySweeps: MarketStructure[];
  pdZone: ReturnType<typeof getPremiumDiscountZone>;
  hasBullishBOS: boolean;
  hasBearishBOS: boolean;
  hasBullishFVG: boolean;
  hasBearishFVG: boolean;
  hasBullishOB: boolean;
  hasBearishOB: boolean;
  hasBullishSweep: boolean;
  hasBearishSweep: boolean;
  hasBullishMSS: boolean;
  hasBearishMSS: boolean;
  bullishScore: number; // 0-100
  bearishScore: number; // 0-100
}

export function runICTAnalysis(candles: OHLCVCandle[]): ICTAnalysis {
  const swings = detectSwingPoints(candles, 5);
  const classified = classifySwings(swings);
  const bosCHOCH = detectBOSandCHOCH(candles, swings);
  const structures = [...classified, ...bosCHOCH];
  const fvgs = detectFVGs(candles);
  const orderBlocks = detectOrderBlocks(candles);
  const liquiditySweeps = detectLiquiditySweep(candles, swings);
  const pdZone = getPremiumDiscountZone(candles);

  const hasBullishBOS = bosCHOCH.some(s => s.type === 'BOS' && s.direction === 'BULLISH');
  const hasBearishBOS = bosCHOCH.some(s => s.type === 'BOS' && s.direction === 'BEARISH');
  const hasBullishFVG = fvgs.some(f => f.direction === 'BULLISH' && !f.filled);
  const hasBearishFVG = fvgs.some(f => f.direction === 'BEARISH' && !f.filled);
  const hasBullishOB = orderBlocks.some(o => o.direction === 'BULLISH');
  const hasBearishOB = orderBlocks.some(o => o.direction === 'BEARISH');
  const hasBullishMSS = bosCHOCH.some(s => s.type === 'MSS' && s.direction === 'BULLISH');
  const hasBearishMSS = bosCHOCH.some(s => s.type === 'MSS' && s.direction === 'BEARISH');
  const hasBullishSweep = liquiditySweeps.some(s => s.direction === 'BULLISH');
  const hasBearishSweep = liquiditySweeps.some(s => s.direction === 'BEARISH');

  // Recent structure bias
  const recentStructures = structures.slice(-6);
  const bullishCount = recentStructures.filter(s => s.direction === 'BULLISH').length;
  const bearishCount = recentStructures.filter(s => s.direction === 'BEARISH').length;

  let bullishScore = 0;
  let bearishScore = 0;

  if (hasBullishBOS) bullishScore += 30;
  if (hasBullishMSS) bullishScore += 30;
  if (hasBullishFVG) bullishScore += 20;
  if (hasBullishOB) bullishScore += 20;
  if (hasBullishSweep) bullishScore += 20;
  if (pdZone.zone === 'DISCOUNT') bullishScore += 10;
  bullishScore += (bullishCount / Math.max(1, recentStructures.length)) * 10;

  if (hasBearishBOS) bearishScore += 30;
  if (hasBearishMSS) bearishScore += 30;
  if (hasBearishFVG) bearishScore += 20;
  if (hasBearishOB) bearishScore += 20;
  if (hasBearishSweep) bearishScore += 20;
  if (pdZone.zone === 'PREMIUM') bearishScore += 10;
  bearishScore += (bearishCount / Math.max(1, recentStructures.length)) * 10;

  return {
    swings,
    structures,
    fvgs,
    orderBlocks,
    liquiditySweeps,
    pdZone,
    hasBullishBOS,
    hasBearishBOS,
    hasBullishFVG,
    hasBearishFVG,
    hasBullishOB,
    hasBearishOB,
    hasBullishMSS,
    hasBearishMSS,
    hasBullishSweep,
    hasBearishSweep,
    bullishScore: Math.min(100, bullishScore),
    bearishScore: Math.min(100, bearishScore),
  };
}
