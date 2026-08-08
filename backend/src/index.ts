import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initTelegramBot } from './telegram/TelegramBot';
import { generateSignal } from './signals/SignalEngine';
import { getActiveSignals, getSignalById, updateSignalStatus } from './db';
import { registerSignalOnChain, updateSignalStatusOnChain } from './algorand/AlgorandService';
import { broadcastSignal } from './telegram/TelegramBot';
import { getAllPrices, getLatestPrice, marketEvents, getMarketStatus } from './market/MarketDataProvider';
import apiRouter from './routes/api';
import { addSSEClient, broadcast } from './sse';

// ─── Validate environment ──────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS ?? '300000', 10); // 5 min default
const SYMBOLS = (process.env.SYMBOLS ?? 'BTC/USDT,ETH/USDT').split(',').map(s => s.trim());

console.log(`[SYSTEM] Starting TradeSense AI`);
console.log(`[SYSTEM] Network: ${process.env.ALGORAND_NETWORK ?? 'testnet'}`);
console.log(`[SYSTEM] App ID: ${process.env.ALGORAND_APP_ID ?? '1008'}`);
console.log(`[SYSTEM] Demo Mode: ${DEMO_MODE}`);
console.log(`[SYSTEM] Symbols: ${SYMBOLS.join(', ')}`);

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Serve frontend static files if built
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// ─── SSE Endpoint ─────────────────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'SYSTEM', data: { message: 'Connected' }, timestamp: Date.now() })}\n\n`);

  addSSEClient(res);
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// Fallback: serve frontend index.html for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.json({ service: 'TradeSense AI Backend', status: 'running', version: '1.0.0' });
    }
  });
});

// ─── Market scan loop ─────────────────────────────────────────────────────────
async function runMarketScan(): Promise<void> {
  console.log('[SCAN] Running market scan...');

  // Broadcast price updates
  try {
    const prices = await getAllPrices();
    broadcast({ type: 'PRICE_UPDATE', data: prices, timestamp: Date.now() });
  } catch (err) {
    console.warn('[SCAN] Failed to get prices:', err);
  }

  // Check signal outcomes for active signals
  const active = getActiveSignals();
  for (const signal of active) {
    try {
      const tick = await getLatestPrice(signal.symbol);
      const price = tick.price;
      let newStatus: string | null = null;
      let newOutcome: string | null = null;

      if (signal.direction === 'LONG') {
        if (price >= signal.takeProfit) { newStatus = 'TP_HIT'; newOutcome = 'WIN'; }
        else if (price <= signal.stopLoss) { newStatus = 'SL_HIT'; newOutcome = 'LOSS'; }
      } else {
        if (price <= signal.takeProfit) { newStatus = 'TP_HIT'; newOutcome = 'WIN'; }
        else if (price >= signal.stopLoss) { newStatus = 'SL_HIT'; newOutcome = 'LOSS'; }
      }

      if (newStatus && newOutcome) {
        console.log(`[SCAN] ${signal.symbol} ${newStatus} - updating...`);
        // Update on-chain if registered
        const chainResult = await updateSignalStatusOnChain(signal, newStatus, newOutcome);
        updateSignalStatus(signal.id, newStatus, newOutcome, chainResult.txId);

        const updated = getSignalById(signal.id)!;
        broadcast({ type: 'STATUS_UPDATE', data: updated, timestamp: Date.now() });

        // Notify via Telegram
        await broadcastSignal(updated);
      }
    } catch (err) {
      console.warn(`[SCAN] Error checking outcome for ${signal.id}:`, err);
    }
  }

  // In Live mode, new signals are driven by CANDLE_CLOSED WS event.
  // We keep this demo generation fallback if DEMO_MODE is true.
  if (DEMO_MODE) {
    for (const symbol of SYMBOLS) {
      try {
        const newSignal = await generateSignal(symbol);
        if (newSignal) {
          // Register on Algorand
          const chainResult = await registerSignalOnChain(newSignal);
          if (chainResult.success) {
            const updated = getSignalById(newSignal.id);
            if (updated) {
              broadcast({ type: 'SIGNAL', data: updated, timestamp: Date.now() });
              await broadcastSignal(updated);
            }
          } else {
            broadcast({ type: 'SIGNAL', data: newSignal, timestamp: Date.now() });
            await broadcastSignal(newSignal);
          }
        }
      } catch (err) {
        console.warn(`[SCAN] Error generating signal for ${symbol}:`, err);
      }
    }
  }
}

// ─── Live WS Event Listeners ────────────────────────────────────────────────────
if (!DEMO_MODE) {
  marketEvents.on('PRICE_UPDATE', (tick) => {
    broadcast({ type: 'PRICE_UPDATE', data: [tick], timestamp: Date.now() });
  });

  marketEvents.on('STATUS_UPDATE', () => {
    broadcast({ type: 'MARKET_STATUS', data: getMarketStatus(), timestamp: Date.now() });
  });

  marketEvents.on('CANDLE_CLOSED', async (symbol) => {
    console.log(`[MARKET] 1m candle closed for ${symbol}, triggering live analysis...`);
    try {
      // 1. Broadcast Market Intelligence update
      const { getOHLCV, getLatestPrice } = await import('./market/MarketDataProvider');
      const { analyzeVolume } = await import('./analysis/VolumeEngine');
      const { analyzeLiquidity } = await import('./analysis/LiquidityEngine');
      const { runICTAnalysis } = await import('./analysis/ICTEngine');
      
      const candles = await getOHLCV(symbol, '1m', 200);
      const tick = await getLatestPrice(symbol);
      
      if (candles && candles.length >= 200) {
        const intel = {
          symbol,
          volume: analyzeVolume(candles),
          liquidity: analyzeLiquidity(candles, tick.price),
          ict: runICTAnalysis(candles)
        };
        broadcast({ type: 'MARKET_INTELLIGENCE', data: intel, timestamp: Date.now() });
      }

      // 2. Generate signal
      const newSignal = await generateSignal(symbol);
      if (newSignal) {
        const chainResult = await registerSignalOnChain(newSignal);
        if (chainResult.success) {
          const updated = getSignalById(newSignal.id);
          if (updated) {
            broadcast({ type: 'SIGNAL', data: updated, timestamp: Date.now() });
            await broadcastSignal(updated);
          }
        } else {
          broadcast({ type: 'SIGNAL', data: newSignal, timestamp: Date.now() });
          await broadcastSignal(newSignal);
        }
      }
    } catch (err) {
      console.warn(`[MARKET] Error during live analysis for ${symbol}:`, err);
    }
  });
}

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n[SERVER] ✅ TradeSense AI running on port ${PORT}`);
  console.log(`[SERVER] API: http://localhost:${PORT}/api`);
  console.log(`[SERVER] Health: http://localhost:${PORT}/api/health`);

  // Initialize Telegram bot
  initTelegramBot();

  // Initial scan after 5 seconds
  setTimeout(runMarketScan, 5000);

  // Schedule periodic scans
  setInterval(runMarketScan, SCAN_INTERVAL_MS);

  console.log(`[SERVER] Market scan interval: ${SCAN_INTERVAL_MS / 1000}s`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection:', reason);
});
