import axios from 'axios';
import type { TradingSignal, MarketTick, PerformanceStats, HealthStatus } from './types';

const BASE = import.meta.env.VITE_API_URL || '/api';

export async function getHealth(): Promise<HealthStatus> {
  const res = await axios.get(`${BASE}/health`);
  return res.data;
}

export async function getSignals(limit = 50): Promise<TradingSignal[]> {
  const res = await axios.get(`${BASE}/signals?limit=${limit}`);
  return res.data.data;
}

export async function getActiveSignals(): Promise<TradingSignal[]> {
  const res = await axios.get(`${BASE}/signals/active`);
  return res.data.data;
}

export async function getPerformance(): Promise<PerformanceStats> {
  const res = await axios.get(`${BASE}/performance`);
  return res.data.data;
}

export async function getPrices(): Promise<MarketTick[]> {
  const res = await axios.get(`${BASE}/market/prices`);
  return res.data.data;
}

// Demo actions
export async function generateDemoSignal(symbol = 'BTC/USDT', direction?: string): Promise<TradingSignal> {
  const res = await axios.post(`${BASE}/demo/generate`, { symbol, direction });
  return res.data.data;
}

export async function runLiveAnalysis(symbol = 'BTC/USDT'): Promise<TradingSignal | null> {
  const res = await axios.post(`${BASE}/analyze`, { symbol });
  return res.data.data;
}

export async function sendTelegram(signalId?: string): Promise<void> {
  await axios.post(`${BASE}/demo/send-telegram`, { signalId });
}

export async function registerBlockchain(signalId?: string) {
  const res = await axios.post(`${BASE}/demo/register-blockchain`, { signalId });
  return res.data;
}

export async function simulateTP(signalId?: string): Promise<TradingSignal> {
  const res = await axios.post(`${BASE}/demo/simulate-tp`, { signalId });
  return res.data.data;
}

export async function simulateSL(signalId?: string): Promise<TradingSignal> {
  const res = await axios.post(`${BASE}/demo/simulate-sl`, { signalId });
  return res.data.data;
}
