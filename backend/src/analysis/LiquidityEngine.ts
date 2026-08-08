import type { OHLCVCandle, LiquidityAnalysis, LiquidityZone, LiquiditySweep } from '../types';

export function analyzeLiquidity(candles: OHLCVCandle[], currentPrice: number, pivotLeft = 5, pivotRight = 5): LiquidityAnalysis | null {
  if (!candles || candles.length < pivotLeft + pivotRight + 1) return null;

  const highs: LiquidityZone[] = [];
  const lows: LiquidityZone[] = [];
  const sweeps: LiquiditySweep[] = [];
  
  // Calculate ATR for tolerance
  const atr = calculateATR(candles.slice(-14));
  const tolerance = atr * 0.1;

  // Identify Swings
  for (let i = pivotLeft; i < candles.length - pivotRight; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= pivotLeft; j++) {
      if (candles[i - j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low) isLow = false;
    }
    for (let j = 1; j <= pivotRight; j++) {
      if (candles[i + j].high >= c.high) isHigh = false;
      if (candles[i + j].low <= c.low) isLow = false;
    }

    if (isHigh) {
      highs.push({
        type: 'BSL',
        price: c.high,
        distanceFromPrice: Math.abs(currentPrice - c.high) / currentPrice * 100,
        strength: 50, // base strength
        source: 'Swing High',
        timestamp: c.timestamp,
      });
    }

    if (isLow) {
      lows.push({
        type: 'SSL',
        price: c.low,
        distanceFromPrice: Math.abs(currentPrice - c.low) / currentPrice * 100,
        strength: 50,
        source: 'Swing Low',
        timestamp: c.timestamp,
      });
    }
  }

  const eqh: LiquidityZone[] = [];
  const eql: LiquidityZone[] = [];

  // Identify EQH
  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) <= tolerance) {
        eqh.push({
          type: 'EQH',
          price: (highs[i].price + highs[j].price) / 2,
          distanceFromPrice: Math.abs(currentPrice - highs[i].price) / currentPrice * 100,
          strength: 80,
          source: 'Equal Highs',
          timestamp: highs[j].timestamp, // Latest timestamp
        });
      }
    }
  }

  // Identify EQL
  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i].price - lows[j].price) <= tolerance) {
        eql.push({
          type: 'EQL',
          price: (lows[i].price + lows[j].price) / 2,
          distanceFromPrice: Math.abs(currentPrice - lows[i].price) / currentPrice * 100,
          strength: 80,
          source: 'Equal Lows',
          timestamp: lows[j].timestamp,
        });
      }
    }
  }

  // Deduplicate EQH / EQL and merge into BSL / SSL
  const bsl = [...highs, ...eqh].sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);
  const ssl = [...lows, ...eql].sort((a, b) => a.distanceFromPrice - b.distanceFromPrice);

  // Sweep Detection
  // Check the most recent closed candle
  const recent = candles[candles.length - 2];
  if (recent) {
    // Buy Side Sweep
    for (const pool of bsl) {
      if (recent.high > pool.price && recent.close < pool.price) {
        sweeps.push({
          detected: true,
          type: 'BUY-SIDE SWEEP',
          liquidityLevel: pool.price,
          sweepPrice: recent.high,
          confirmationCandle: recent.timestamp,
          timestamp: Date.now(),
          confidence: 85,
        });
        break; // Count highest confident one
      }
    }

    // Sell Side Sweep
    for (const pool of ssl) {
      if (recent.low < pool.price && recent.close > pool.price) {
        sweeps.push({
          detected: true,
          type: 'SELL-SIDE SWEEP',
          liquidityLevel: pool.price,
          sweepPrice: recent.low,
          confirmationCandle: recent.timestamp,
          timestamp: Date.now(),
          confidence: 85,
        });
        break;
      }
    }
  }

  // Nearest Pool
  let nearestPool: 'BSL' | 'SSL' | null = null;
  const nearestBSL = bsl.find(b => b.price > currentPrice);
  const nearestSSL = ssl.find(s => s.price < currentPrice);
  
  if (nearestBSL && nearestSSL) {
    nearestPool = nearestBSL.distanceFromPrice < nearestSSL.distanceFromPrice ? 'BSL' : 'SSL';
  } else if (nearestBSL) {
    nearestPool = 'BSL';
  } else if (nearestSSL) {
    nearestPool = 'SSL';
  }

  return {
    bsl,
    ssl,
    eqh,
    eql,
    sweeps,
    nearestPool,
  };
}

function calculateATR(candles: OHLCVCandle[]): number {
  if (candles.length === 0) return 0;
  let trSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
  }
  return trSum / (candles.length - 1 || 1);
}
