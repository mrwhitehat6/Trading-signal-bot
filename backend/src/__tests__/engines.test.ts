import { analyzeTechnicals } from '../analysis/TechnicalEngine';
import { runICTAnalysis } from '../analysis/ICTEngine';
import { calculateConfidence } from '../signals/ConfidenceEngine';
import type { OHLCVCandle } from '../types';

describe('Trading Signal Engines', () => {

  const generateDummyCandles = (count: number, trend: 'UP' | 'DOWN' = 'UP'): OHLCVCandle[] => {
    const candles: OHLCVCandle[] = [];
    let price = 50000;
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      if (trend === 'UP') price += Math.random() * 100;
      else price -= Math.random() * 100;
      
      candles.push({
        timestamp: now - (count - i) * 60000,
        open: price - 10,
        high: price + 20,
        low: price - 20,
        close: price,
        volume: 100 + Math.random() * 50
      });
    }
    return candles;
  };

  test('TechnicalEngine calculates indicators correctly', () => {
    const candles = generateDummyCandles(200, 'UP');
    const tech = analyzeTechnicals(candles);
    
    expect(tech).toBeDefined();
    expect(tech!.ema9).toBeGreaterThan(0);
    expect(tech!.rsi).toBeGreaterThan(0);
    expect(tech!.volumeRatio).toBeDefined();
    expect(['BULLISH', 'BEARISH', 'SIDEWAYS']).toContain(tech!.trend);
  });

  test('ICTEngine analyzes market structure', () => {
    const candles = generateDummyCandles(200, 'UP');
    
    // Create an artificial swing high then higher high to trigger BOS
    candles[150].high = 60000;
    candles[180].low = 58000;
    candles[195].high = 65000;
    
    const ict = runICTAnalysis(candles);
    
    expect(ict).toBeDefined();
    expect(ict.structures).toBeDefined();
    expect(ict.pdZone.zone).toBeDefined();
  });

  test('ConfidenceEngine calculates score based on inputs', () => {
    const mockTech = {
      ema9: 50000, ema20: 49000, ema50: 48000, ema200: 45000,
      rsi: 65, macd: 100, macdSignal: 50, macdHist: 50,
      atr: 100, vwap: 49000, volumeAvg: 100, volumeRatio: 1.5,
      trend: 'BULLISH' as const, volatility: 'NORMAL' as const
    };
    
    const mockIct = {
      structures: [], swings: [], fvgs: [], orderBlocks: [], liquiditySweeps: [],
      hasBullishBOS: true, hasBearishBOS: false,
      hasBullishCHOCH: false, hasBearishCHOCH: false,
      hasBullishSweep: true, hasBearishSweep: false,
      hasBullishFVG: true, hasBearishFVG: false,
      hasBullishOB: true, hasBearishOB: false,
      pdZone: { zone: 'DISCOUNT' as const, premiumLevel: 0, discountLevel: 0, eqLevel: 0 }
    } as any;
    
    const result = calculateConfidence('LONG', mockTech, mockIct, 2.5, 49500, null as any, null as any);
    
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThan(50);
    expect(result.level).toBeDefined();
    expect(result.risk).toBeGreaterThan(0);
    expect(result.technical).toBeGreaterThan(0);
  });
});
