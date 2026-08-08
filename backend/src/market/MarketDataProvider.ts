import axios from 'axios';
import WebSocket from 'ws';
import EventEmitter from 'events';
import yahooFinance from 'yahoo-finance2';
import type { OHLCVCandle, MarketTick, MarketStatus } from '../types';

export const marketEvents = new EventEmitter();

const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';

// Symbol mapping
const BINANCE_SYMBOLS: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'SOL/USDT': 'SOLUSDT',
  'BNB/USDT': 'BNBUSDT',
};

const YAHOO_SYMBOLS: Record<string, string> = {
  'NIFTY': '^NSEI',
};

const ALL_SYMBOLS = [...Object.keys(BINANCE_SYMBOLS), ...Object.keys(YAHOO_SYMBOLS)];

const REVERSE_BINANCE: Record<string, string> = Object.entries(BINANCE_SYMBOLS).reduce(
  (acc, [key, val]) => ({ ...acc, [val]: key }),
  {}
);

let marketStatus: MarketStatus = {
  status: 'OFFLINE',
  lastUpdate: 0,
  provider: 'Binance+Yahoo',
};

const livePrices = new Map<string, MarketTick>();
const liveCandles = new Map<string, OHLCVCandle[]>();
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let yahooPollTimer: NodeJS.Timeout | null = null;
const isLiveMode = process.env.LIVE_MODE === 'true';

// Setup basic ticks
ALL_SYMBOLS.forEach(sym => {
  livePrices.set(sym, {
    symbol: sym, price: 0, change24h: 0, changePct24h: 0,
    volume24h: 0, high24h: 0, low24h: 0, timestamp: Date.now()
  });
  liveCandles.set(sym, []);
});

export async function fetchHistoricalCandles(symbol: string, interval = '1m', limit = 200): Promise<void> {
  try {
    if (BINANCE_SYMBOLS[symbol]) {
      const res = await axios.get(`${BINANCE_REST_BASE}/klines`, {
        params: { symbol: BINANCE_SYMBOLS[symbol], interval, limit },
        timeout: 8000,
      });

      const candles: OHLCVCandle[] = res.data.map((k: any[]) => ({
        timestamp: k[0] as number,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      liveCandles.set(symbol, candles);

    } else if (YAHOO_SYMBOLS[symbol]) {
      // Fetch from Yahoo
      const yInterval = interval === '1m' ? '1m' : interval === '5m' ? '5m' : '15m';
      const result: any = await yahooFinance.chart(YAHOO_SYMBOLS[symbol], { interval: yInterval as any, range: '5d' });
      if (result && result.quotes) {
        const candles: OHLCVCandle[] = result.quotes
          .filter((q: any) => q.open !== null && q.close !== null)
          .map((q: any) => ({
            timestamp: q.date.getTime(),
            open: q.open!,
            high: q.high!,
            low: q.low!,
            close: q.close!,
            volume: q.volume || 0,
          }))
          .slice(-limit);
        
        liveCandles.set(symbol, candles);
      }
    }
  } catch (err) {
    console.error(`[MARKET] Failed to fetch history for ${symbol}:`, err);
  }
}

async function pollYahooNifty() {
  try {
    const symbol = 'NIFTY';
    const result: any = await yahooFinance.chart(YAHOO_SYMBOLS[symbol], { interval: '1m', range: '1d' });
    if (result && result.quotes && result.quotes.length > 0) {
      const lastQ = result.quotes[result.quotes.length - 1];
      if (lastQ.open !== null) {
        // Update Price
        const prevPrice = livePrices.get(symbol)?.price || lastQ.close!;
        const change = lastQ.close! - prevPrice;
        const changePct = (change / (prevPrice || 1)) * 100;
        
        const tick: MarketTick = {
          symbol,
          price: lastQ.close!,
          change24h: change,
          changePct24h: changePct,
          volume24h: lastQ.volume || 0,
          high24h: lastQ.high!,
          low24h: lastQ.low!,
          timestamp: lastQ.date.getTime(),
        };
        livePrices.set(symbol, tick);
        marketStatus.lastUpdate = Date.now();
        marketEvents.emit('PRICE_UPDATE', tick);

        // Update Candles
        const candles = liveCandles.get(symbol) || [];
        const newCandle: OHLCVCandle = {
          timestamp: lastQ.date.getTime(),
          open: lastQ.open!,
          high: lastQ.high!,
          low: lastQ.low!,
          close: lastQ.close!,
          volume: lastQ.volume || 0,
        };

        if (candles.length > 0) {
          const lastC = candles[candles.length - 1];
          if (lastC.timestamp === newCandle.timestamp) {
            candles[candles.length - 1] = newCandle;
          } else if (newCandle.timestamp > lastC.timestamp) {
            candles.push(newCandle);
            if (candles.length > 300) candles.shift();
            marketEvents.emit('CANDLE_CLOSED', symbol); // Previous candle closed
          }
        } else {
          candles.push(newCandle);
        }
        liveCandles.set(symbol, candles);
      }
    }
  } catch (err) {
    console.error('[MARKET] Yahoo Polling Error', err);
  }

  if (isLiveMode) {
    yahooPollTimer = setTimeout(pollYahooNifty, 60000); // Poll every minute
  }
}

export function initWebSocket() {
  if (!isLiveMode) {
    marketStatus = { status: 'OFFLINE', lastUpdate: Date.now(), provider: 'Demo' };
    return;
  }

  if (ws) ws.close();
  if (yahooPollTimer) clearTimeout(yahooPollTimer);

  marketStatus = { status: 'RECONNECTING', lastUpdate: Date.now(), provider: 'Binance+Yahoo' };

  // 1. Binance WS
  ws = new WebSocket(BINANCE_WS_BASE);

  ws.on('open', () => {
    console.log('[MARKET] WebSocket connected to Binance');
    marketStatus = { status: 'LIVE', lastUpdate: Date.now(), provider: 'Binance+Yahoo' };
    
    const streams = Object.values(BINANCE_SYMBOLS).flatMap(sym => [
      `${sym.toLowerCase()}@ticker`,
      `${sym.toLowerCase()}@kline_1m`
    ]);

    ws!.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: streams,
      id: 1
    }));
  });

  ws.on('message', (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      if (!msg.e) return;

      if (msg.e === '24hrTicker') {
        const symbol = REVERSE_BINANCE[msg.s];
        if (symbol) {
          const tick: MarketTick = {
            symbol,
            price: parseFloat(msg.c),
            change24h: parseFloat(msg.p),
            changePct24h: parseFloat(msg.P),
            volume24h: parseFloat(msg.v),
            high24h: parseFloat(msg.h),
            low24h: parseFloat(msg.l),
            timestamp: msg.E,
          };
          livePrices.set(symbol, tick);
          marketStatus.lastUpdate = Date.now();
          marketEvents.emit('PRICE_UPDATE', tick);
        }
      } else if (msg.e === 'kline') {
        const symbol = REVERSE_BINANCE[msg.s];
        if (symbol) {
          const k = msg.k;
          const candle: OHLCVCandle = {
            timestamp: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v)
          };
          
          const candles = liveCandles.get(symbol) || [];
          if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            if (lastCandle.timestamp === candle.timestamp) {
              candles[candles.length - 1] = candle;
            } else if (candle.timestamp > lastCandle.timestamp) {
              candles.push(candle);
              if (candles.length > 300) candles.shift();
            }
          } else {
            candles.push(candle);
          }
          liveCandles.set(symbol, candles);
          
          if (k.x) {
            marketEvents.emit('CANDLE_CLOSED', symbol);
          }
        }
      }
    } catch (err) {
      console.error('[MARKET] WS Message Parse Error', err);
    }
  });

  ws.on('close', () => {
    console.warn('[MARKET] WebSocket disconnected. Reconnecting in 5s...');
    marketStatus = { status: 'RECONNECTING', lastUpdate: Date.now(), provider: 'Binance+Yahoo' };
    marketEvents.emit('STATUS_UPDATE');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(initWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('[MARKET] WebSocket Error', err);
    ws?.close();
  });

  // 2. Yahoo Polling Loop
  pollYahooNifty();
}

// Ensure historical data is populated at startup
if (isLiveMode) {
  Promise.all(ALL_SYMBOLS.map(sym => fetchHistoricalCandles(sym))).then(() => {
    initWebSocket();
  });
}

export async function getLatestPrice(symbol: string): Promise<MarketTick> {
  const tick = livePrices.get(symbol);
  if (tick && tick.price > 0) return tick;

  // Fallback
  if (BINANCE_SYMBOLS[symbol]) {
    const binanceSym = BINANCE_SYMBOLS[symbol];
    const [tickerRes, statsRes] = await Promise.all([
      axios.get(`${BINANCE_REST_BASE}/ticker/price`, { params: { symbol: binanceSym }, timeout: 5000 }),
      axios.get(`${BINANCE_REST_BASE}/ticker/24hr`, { params: { symbol: binanceSym }, timeout: 5000 }),
    ]);

    const fallbackTick: MarketTick = {
      symbol,
      price: parseFloat(tickerRes.data.price),
      change24h: parseFloat(statsRes.data.priceChange),
      changePct24h: parseFloat(statsRes.data.priceChangePercent),
      volume24h: parseFloat(statsRes.data.volume),
      high24h: parseFloat(statsRes.data.highPrice),
      low24h: parseFloat(statsRes.data.lowPrice),
      timestamp: Date.now(),
    };
    return fallbackTick;
  } else if (YAHOO_SYMBOLS[symbol]) {
    const res: any = await yahooFinance.quote(YAHOO_SYMBOLS[symbol]);
    return {
      symbol,
      price: res.regularMarketPrice || 0,
      change24h: res.regularMarketChange || 0,
      changePct24h: res.regularMarketChangePercent || 0,
      volume24h: res.regularMarketVolume || 0,
      high24h: res.regularMarketDayHigh || 0,
      low24h: res.regularMarketDayLow || 0,
      timestamp: Date.now(),
    };
  }

  throw new Error(`Unsupported symbol: ${symbol}`);
}

export async function getOHLCV(symbol: string, timeframe = '1m', limit = 200): Promise<OHLCVCandle[]> {
  const candles = liveCandles.get(symbol);
  if (candles && candles.length >= limit) {
    return candles.slice(-limit);
  }
  
  await fetchHistoricalCandles(symbol, timeframe, limit);
  return (liveCandles.get(symbol) || []).slice(-limit);
}

export async function getAllPrices(): Promise<MarketTick[]> {
  const results: MarketTick[] = [];
  for (const sym of ALL_SYMBOLS) {
    try {
      const tick = await getLatestPrice(sym);
      results.push(tick);
    } catch {
      console.warn(`[MARKET] Failed to get price for ${sym}`);
    }
  }
  return results;
}

export function getMarketStatus(): MarketStatus {
  if (isLiveMode && marketStatus.status === 'LIVE' && Date.now() - marketStatus.lastUpdate > 120000) {
    marketStatus.status = 'RECONNECTING';
  }
  return marketStatus;
}

export function getSupportedSymbols(): string[] {
  return ALL_SYMBOLS;
}
