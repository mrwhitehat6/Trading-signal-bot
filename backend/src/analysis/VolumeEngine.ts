import type { OHLCVCandle, VolumeAnalysis } from '../types';

export function analyzeVolume(candles: OHLCVCandle[], lookback = 20): VolumeAnalysis | null {
  if (!candles || candles.length < lookback) return null;

  const currentCandle = candles[candles.length - 1];
  const previousCandles = candles.slice(candles.length - 1 - lookback, candles.length - 1);

  const averageVolume = previousCandles.reduce((sum, c) => sum + c.volume, 0) / lookback;
  
  if (averageVolume === 0) {
    return {
      currentVolume: currentCandle.volume,
      averageVolume: 0,
      rvol: 0,
      volumeState: 'LOW',
      volumeSpike: false,
      volumeTrend: 'FLAT',
      timestamp: currentCandle.timestamp,
    };
  }

  const rvol = currentCandle.volume / averageVolume;

  let volumeState: 'LOW' | 'NORMAL' | 'HIGH' | 'VERY HIGH' = 'NORMAL';
  if (rvol < 0.75) volumeState = 'LOW';
  else if (rvol >= 1.25 && rvol < 1.75) volumeState = 'HIGH';
  else if (rvol >= 1.75) volumeState = 'VERY HIGH';

  const volumeSpike = currentCandle.volume >= averageVolume * 1.5;

  let volumeTrend: 'INCREASING' | 'DECREASING' | 'FLAT' = 'FLAT';
  if (currentCandle.volume > previousCandles[previousCandles.length - 1].volume) {
    volumeTrend = 'INCREASING';
  } else if (currentCandle.volume < previousCandles[previousCandles.length - 1].volume) {
    volumeTrend = 'DECREASING';
  }

  return {
    currentVolume: currentCandle.volume,
    averageVolume,
    rvol,
    volumeState,
    volumeSpike,
    volumeTrend,
    timestamp: currentCandle.timestamp,
  };
}
