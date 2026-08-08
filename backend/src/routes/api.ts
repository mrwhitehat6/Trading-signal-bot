import { Router, type Request, type Response } from 'express';
import {
  getSignals,
  getActiveSignals,
  getSignalById,
  getPerformanceStats,
  updateSignalStatus,
  logEvent,
} from '../db';
import { generateSignal, generateDemoSignal } from '../signals/SignalEngine';
import { registerSignalOnChain, updateSignalStatusOnChain, getAlgorandStatus, getExplorerUrl } from '../algorand/AlgorandService';
import { getBotStatus, broadcastSignal } from '../telegram/TelegramBot';
import { getMarketStatus, getAllPrices, getLatestPrice } from '../market/MarketDataProvider';
import { broadcast } from '../sse';

const router = Router();

// ─── Health ────────────────────────────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  const algorand = getAlgorandStatus();
  const telegram = getBotStatus();
  const market = getMarketStatus();

  res.json({
    status: 'OK',
    timestamp: Date.now(),
    services: {
      api: 'ONLINE',
      database: 'ONLINE',
      marketData: market.status,
      telegram: telegram.connected ? 'ONLINE' : 'OFFLINE',
      algorand: algorand.connected ? 'ONLINE' : 'DEGRADED',
    },
    market,
    algorand,
    telegram,
  });
});

// ─── Market Data ──────────────────────────────────────────────────────────────
router.get('/market/prices', async (_req: Request, res: Response) => {
  try {
    const prices = await getAllPrices();
    res.json({ success: true, data: prices });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Market data unavailable' });
  }
});

router.get('/market/price/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(String(req.params.symbol));
    const tick = await getLatestPrice(symbol);
    res.json({ success: true, data: tick });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Price unavailable' });
  }
});

// ─── Market Intelligence ────────────────────────────────────────────────────────
router.get('/market/:symbol/volume', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(String(req.params.symbol));
    const { getOHLCV } = await import('../market/MarketDataProvider');
    const { analyzeVolume } = await import('../analysis/VolumeEngine');
    const candles = await getOHLCV(symbol, '1m', 200);
    const volumeData = analyzeVolume(candles);
    res.json({ success: true, data: volumeData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Volume data unavailable' });
  }
});

router.get('/market/:symbol/liquidity', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(String(req.params.symbol));
    const { getOHLCV, getLatestPrice } = await import('../market/MarketDataProvider');
    const { analyzeLiquidity } = await import('../analysis/LiquidityEngine');
    const candles = await getOHLCV(symbol, '1m', 200);
    const tick = await getLatestPrice(symbol);
    const liquidityData = analyzeLiquidity(candles, tick.price);
    res.json({ success: true, data: liquidityData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Liquidity data unavailable' });
  }
});

router.get('/market/:symbol/analysis', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(String(req.params.symbol));
    const { getOHLCV, getLatestPrice } = await import('../market/MarketDataProvider');
    const { analyzeVolume } = await import('../analysis/VolumeEngine');
    const { analyzeLiquidity } = await import('../analysis/LiquidityEngine');
    const { runICTAnalysis } = await import('../analysis/ICTEngine');
    
    const candles = await getOHLCV(symbol, '1m', 200);
    const tick = await getLatestPrice(symbol);
    
    const volumeData = analyzeVolume(candles);
    const liquidityData = analyzeLiquidity(candles, tick.price);
    const ictData = runICTAnalysis(candles);
    
    res.json({ 
      success: true, 
      data: {
        volume: volumeData,
        liquidity: liquidityData,
        ict: ictData
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Analysis unavailable' });
  }
});

// ─── News ─────────────────────────────────────────────────────────────────────
router.get('/news/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = decodeURIComponent(String(req.params.symbol));
    const { getCachedNewsData, processNewsForAsset } = await import('../news/NewsEngine');
    
    // Serve from cache if available and not explicitly forced
    let data = getCachedNewsData(symbol);
    if (!data || req.query.force) {
      data = await processNewsForAsset(symbol);
    }
    
    if (data) {
      res.json({ success: true, data });
    } else {
      res.status(404).json({ success: false, error: 'No news found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to process news' });
  }
});

// ─── Signals ──────────────────────────────────────────────────────────────────
router.get('/signals', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit) || '50', 10);
  const signals = getSignals(limit);
  res.json({ success: true, data: signals });
});

router.get('/signals/active', (_req: Request, res: Response) => {
  const signals = getActiveSignals();
  res.json({ success: true, data: signals });
});

router.get('/signals/:id', (req: Request, res: Response) => {
  const signal = getSignalById(String(req.params['id']));
  if (!signal) {
    res.status(404).json({ success: false, error: 'Signal not found' });
    return;
  }
  res.json({ success: true, data: signal });
});

// ─── Performance ──────────────────────────────────────────────────────────────
router.get('/performance', (_req: Request, res: Response) => {
  const stats = getPerformanceStats();
  res.json({ success: true, data: stats });
});

// ─── Algorand ─────────────────────────────────────────────────────────────────
router.get('/algorand/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getAlgorandStatus() });
});

router.get('/algorand/explorer/:txId', (req: Request, res: Response) => {
  const url = getExplorerUrl(String(req.params['txId']));
  res.json({ success: true, data: { url } });
});

// ─── Demo / Judge Panel ───────────────────────────────────────────────────────
router.post('/demo/generate', async (req: Request, res: Response) => {
  const { symbol = 'BTC/USDT', direction } = req.body;
  logEvent('DEMO', `Demo signal requested for ${symbol}`);

  try {
    const signal = await generateDemoSignal(symbol, direction);
    if (!signal) {
      res.status(503).json({ success: false, error: 'Could not generate demo signal' });
      return;
    }

    // Broadcast via SSE
    broadcast({ type: 'SIGNAL', data: signal, timestamp: Date.now() });

    res.json({ success: true, data: signal });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/demo/send-telegram', async (req: Request, res: Response) => {
  const { signalId } = req.body;
  const signal = signalId ? getSignalById(signalId) : getSignals(1)[0];

  if (!signal) {
    res.status(404).json({ success: false, error: 'No signal to send' });
    return;
  }

  try {
    await broadcastSignal(signal);
    logEvent('DEMO', `Telegram broadcast for ${signal.id}`);
    res.json({ success: true, message: 'Signal sent via Telegram' });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/demo/register-blockchain', async (req: Request, res: Response) => {
  const { signalId } = req.body;
  const signal = signalId ? getSignalById(signalId) : getSignals(1)[0];

  if (!signal) {
    res.status(404).json({ success: false, error: 'No signal to register' });
    return;
  }

  try {
    const result = await registerSignalOnChain(signal);
    if (result.success) {
      broadcast({ type: 'STATUS_UPDATE', data: { ...signal, algorandTxId: result.txId }, timestamp: Date.now() });
    }
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/demo/simulate-tp', async (req: Request, res: Response) => {
  const { signalId } = req.body;
  const signal = signalId ? getSignalById(signalId) : getActiveSignals()[0];

  if (!signal) {
    res.status(404).json({ success: false, error: 'No active signal to simulate' });
    return;
  }

  try {
    // Update on-chain
    const chainResult = await updateSignalStatusOnChain(signal, 'TP_HIT', 'WIN');
    // Update DB (also handles case if no chain tx)
    updateSignalStatus(signal.id, 'TP_HIT', 'WIN', chainResult.txId);

    logEvent('DEMO', `TP simulated for ${signal.id}`);

    const updatedSignal = getSignalById(signal.id)!;
    broadcast({ type: 'STATUS_UPDATE', data: updatedSignal, timestamp: Date.now() });

    res.json({ success: true, data: updatedSignal, chainResult });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/demo/simulate-sl', async (req: Request, res: Response) => {
  const { signalId } = req.body;
  const signal = signalId ? getSignalById(signalId) : getActiveSignals()[0];

  if (!signal) {
    res.status(404).json({ success: false, error: 'No active signal to simulate' });
    return;
  }

  try {
    const chainResult = await updateSignalStatusOnChain(signal, 'SL_HIT', 'LOSS');
    updateSignalStatus(signal.id, 'SL_HIT', 'LOSS', chainResult.txId);

    logEvent('DEMO', `SL simulated for ${signal.id}`);

    const updatedSignal = getSignalById(signal.id)!;
    broadcast({ type: 'STATUS_UPDATE', data: updatedSignal, timestamp: Date.now() });

    res.json({ success: true, data: updatedSignal, chainResult });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── Live Analysis Status ──────────────────────────────────────────────────────
router.get('/live-analysis/status', (req: Request, res: Response) => {
  res.json({
    liveAnalysis: true,
    marketData: true,
    news: true,
    ai: true,
    database: true,
    algorand: true
  });
});

// ─── Trigger Live Analysis ────────────────────────────────────────────────────
router.post('/analyze', async (req: Request, res: Response) => {
  const { symbol = 'BTC/USDT' } = req.body;

  try {
    console.log(`[LIVE] Request started for ${symbol}`);
    const signal = await generateSignal(symbol, true);
    if (!signal) {
      console.log(`[LIVE] Request failed: No signal conditions met`);
      res.json({ success: false, stage: 'ANALYSIS', error: 'No signal conditions met', details: 'The live market data did not meet the required confidence thresholds.' });
      return;
    }

    broadcast({ type: 'LIVE_PROGRESS', data: { stage: 'algorand', message: 'Registering signal on Algorand TestNet...' }, timestamp: Date.now() });
    await registerSignalOnChain(signal);
    console.log(`[LIVE] Algorand registration completed`);

    broadcast({ type: 'LIVE_PROGRESS', data: { stage: 'telegram', message: 'Broadcasting to Telegram subscribers...' }, timestamp: Date.now() });
    await broadcastSignal(signal);
    
    broadcast({ type: 'SIGNAL', data: signal, timestamp: Date.now() });

    console.log(`[LIVE] Response returned`);
    res.json({ success: true, data: signal });
  } catch (err) {
    console.error(`[LIVE] Request failed with error:`, err);
    res.status(500).json({ 
      success: false, 
      stage: 'API_FAILURE', 
      error: 'Backend API request failed', 
      details: String(err),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
