import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import type { TradingSignal, PerformanceStats } from './types';

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'signals.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let _db: SqlJsDatabase | null = null;

async function getDB(): Promise<SqlJsDatabase> {
  if (_db) return _db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  // Initialize schema
  _db.run(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '15m',
      direction TEXT NOT NULL,
      entry REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      risk_reward REAL NOT NULL,
      confidence REAL NOT NULL,
      quant_score REAL,
      gemini_score REAL,
      confidence_breakdown TEXT NOT NULL,
      strategy TEXT NOT NULL,
      strategy_display TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      outcome TEXT NOT NULL DEFAULT 'PENDING',
      reasons TEXT NOT NULL,
      technical_factors TEXT NOT NULL,
      structure_factors TEXT NOT NULL,
      risk_factors TEXT NOT NULL,
      algorand_app_id INTEGER,
      algorand_tx_id TEXT,
      algorand_timestamp INTEGER,
      ai_explanation TEXT,
      news_data TEXT,
      news_explanation TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
    CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
    CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at);
  `);

  // Run migration if columns don't exist
  try {
    _db.run("ALTER TABLE signals ADD COLUMN quant_score REAL;");
  } catch(e) { /* ignore if exists */ }
  
  try {
    _db.run("ALTER TABLE signals ADD COLUMN gemini_score REAL;");
  } catch(e) { /* ignore if exists */ }

  console.log('[DB] Database initialized');
  // Run automatic migrations
  try {
    _db.run('ALTER TABLE signals ADD COLUMN news_data TEXT;');
  } catch (e) {
    // Ignore if column already exists
  }
  try {
    _db.run('ALTER TABLE signals ADD COLUMN news_explanation TEXT;');
  } catch (e) {
    // Ignore if column already exists
  }

  return _db;
}

function persist(): void {
  if (!_db) return;
  try {
    const data = _db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (err) {
    console.error('[DB] Failed to persist database:', err);
  }
}

// Persist every 10 seconds
setInterval(persist, 10_000);

// ─── Initialize (eager) ────────────────────────────────────────────────────────
let dbReady = false;
const pendingOps: Array<() => void> = [];

getDB().then(() => {
  dbReady = true;
  pendingOps.forEach(op => op());
  pendingOps.length = 0;
}).catch(err => {
  console.error('[DB] Initialization failed:', err);
});

function runWhenReady(op: () => void): void {
  if (dbReady) {
    op();
  } else {
    pendingOps.push(op);
  }
}

// ─── Signal Operations ──────────────────────────────────────────────────────────
function queryAll(sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
  if (!_db) return [];
  const stmt = _db.prepare(sql);
  const results: Record<string, unknown>[] = [];
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

function queryOne(sql: string, params: (string | number | null)[] = []): Record<string, unknown> | null {
  const rows = queryAll(sql, params);
  return rows[0] ?? null;
}

function runSQL(sql: string, params: (string | number | null)[] = []): void {
  if (!_db) throw new Error('Database not initialized');
  _db.run(sql, params);
  persist();
}

function rowToSignal(row: Record<string, unknown>): TradingSignal {
  return {
    id: row['id'] as string,
    symbol: row['symbol'] as string,
    timeframe: row['timeframe'] as string,
    direction: row['direction'] as TradingSignal['direction'],
    entry: row['entry'] as number,
    stopLoss: row['stop_loss'] as number,
    takeProfit: row['take_profit'] as number,
    riskReward: row['risk_reward'] as number,
    confidence: row['confidence'] as number,
    quantScore: row['quant_score'] != null ? (row['quant_score'] as number) : (row['confidence'] as number),
    geminiScore: row['gemini_score'] != null ? (row['gemini_score'] as number) : undefined,
    confidenceBreakdown: JSON.parse(row['confidence_breakdown'] as string),
    strategy: row['strategy'] as TradingSignal['strategy'],
    strategyDisplay: row['strategy_display'] as string,
    timestamp: row['timestamp'] as number,
    status: row['status'] as TradingSignal['status'],
    outcome: row['outcome'] as TradingSignal['outcome'],
    reasons: JSON.parse(row['reasons'] as string),
    technicalFactors: JSON.parse(row['technical_factors'] as string),
    structureFactors: JSON.parse(row['structure_factors'] as string),
    riskFactors: JSON.parse(row['risk_factors'] as string),
    algorandAppId: row['algorand_app_id'] != null ? (row['algorand_app_id'] as number) : undefined,
    algorandTxId: row['algorand_tx_id'] != null ? (row['algorand_tx_id'] as string) : undefined,
    algorandTimestamp: row['algorand_timestamp'] != null ? (row['algorand_timestamp'] as number) : undefined,
    aiExplanation: row['ai_explanation'] != null ? (row['ai_explanation'] as string) : undefined,
    newsData: row['news_data'] != null ? JSON.parse(row['news_data'] as string) : undefined,
    newsExplanation: row['news_explanation'] != null ? (row['news_explanation'] as string) : undefined,
    createdAt: row['created_at'] as number,
    updatedAt: row['updated_at'] as number,
  };
}

export function insertSignal(signal: TradingSignal): void {
  runSQL(`
    INSERT OR REPLACE INTO signals (
      id, symbol, timeframe, direction, entry, stop_loss, take_profit, risk_reward,
      confidence, quant_score, gemini_score, confidence_breakdown, strategy, strategy_display, timestamp, status, outcome,
      reasons, technical_factors, structure_factors, risk_factors,
      algorand_app_id, algorand_tx_id, algorand_timestamp, ai_explanation,
      news_data, news_explanation,
      created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    signal.id,
    signal.symbol,
    signal.timeframe,
    signal.direction,
    signal.entry,
    signal.stopLoss,
    signal.takeProfit,
    signal.riskReward,
    signal.confidence,
    signal.quantScore,
    signal.geminiScore ?? null,
    JSON.stringify(signal.confidenceBreakdown),
    signal.strategy,
    signal.strategyDisplay,
    signal.timestamp,
    signal.status,
    signal.outcome,
    JSON.stringify(signal.reasons),
    JSON.stringify(signal.technicalFactors),
    JSON.stringify(signal.structureFactors),
    JSON.stringify(signal.riskFactors),
    signal.algorandAppId ?? null,
    signal.algorandTxId ?? null,
    signal.algorandTimestamp ?? null,
    signal.aiExplanation ?? null,
    signal.newsData ? JSON.stringify(signal.newsData) : null,
    signal.newsExplanation ?? null,
    signal.createdAt,
    signal.updatedAt,
  ]);
}

export function updateSignalStatus(
  id: string,
  status: string,
  outcome: string,
  algorandTxId?: string
): void {
  runSQL(`
    UPDATE signals 
    SET status=?, outcome=?, updated_at=?, algorand_tx_id=COALESCE(?, algorand_tx_id)
    WHERE id=?
  `, [status, outcome, Date.now(), algorandTxId ?? null, id]);
}

export function updateSignalBlockchain(
  id: string,
  appId: number,
  txId: string,
  blockchainTimestamp: number
): void {
  runSQL(`
    UPDATE signals 
    SET algorand_app_id=?, algorand_tx_id=?, algorand_timestamp=?, updated_at=?
    WHERE id=?
  `, [appId, txId, blockchainTimestamp, Date.now(), id]);
}

export function getSignals(limit = 50): TradingSignal[] {
  const rows = queryAll(`SELECT * FROM signals ORDER BY created_at DESC LIMIT ?`, [limit]);
  return rows.map(rowToSignal);
}

export function getActiveSignals(): TradingSignal[] {
  const rows = queryAll(`SELECT * FROM signals WHERE status='ACTIVE' ORDER BY created_at DESC`);
  return rows.map(rowToSignal);
}

export function getSignalById(id: string): TradingSignal | null {
  const row = queryOne(`SELECT * FROM signals WHERE id=?`, [id]);
  return row ? rowToSignal(row) : null;
}

export function getSignalBySymbol(symbol: string): TradingSignal | null {
  const row = queryOne(`SELECT * FROM signals WHERE symbol=? AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1`, [symbol]);
  return row ? rowToSignal(row) : null;
}

export function getPerformanceStats(): PerformanceStats {
  const total = (queryOne(`SELECT COUNT(*) as cnt FROM signals`) as { cnt: number })?.cnt ?? 0;
  const wins = (queryOne(`SELECT COUNT(*) as cnt FROM signals WHERE outcome='WIN'`) as { cnt: number })?.cnt ?? 0;
  const losses = (queryOne(`SELECT COUNT(*) as cnt FROM signals WHERE outcome='LOSS'`) as { cnt: number })?.cnt ?? 0;
  const active = (queryOne(`SELECT COUNT(*) as cnt FROM signals WHERE status='ACTIVE'`) as { cnt: number })?.cnt ?? 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySignals = (queryOne(`SELECT COUNT(*) as cnt FROM signals WHERE created_at >= ?`, [todayStart.getTime()]) as { cnt: number })?.cnt ?? 0;

  const avgConf = (queryOne(`SELECT AVG(confidence) as avg FROM signals WHERE outcome != 'PENDING'`) as { avg: number })?.avg ?? 0;
  const avgRR = (queryOne(`SELECT AVG(risk_reward) as avg FROM signals WHERE outcome='WIN'`) as { avg: number })?.avg ?? 0;

  const strategyRows = queryAll(`
    SELECT strategy,
           COUNT(*) as total,
           SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END) as losses
    FROM signals GROUP BY strategy
  `) as { strategy: string; total: number; wins: number; losses: number }[];

  const byStrategy: PerformanceStats['byStrategy'] = {};
  let bestStrategy = 'ICT_SMC';
  let bestWinRate = 0;

  for (const r of strategyRows) {
    const wr = r.total > 0 ? (r.wins / r.total) * 100 : 0;
    byStrategy[r.strategy] = { signals: r.total, wins: r.wins, losses: r.losses, winRate: wr };
    if (wr > bestWinRate) { bestWinRate = wr; bestStrategy = r.strategy; }
  }

  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const profitFactor = losses > 0 ? wins / losses : wins > 0 ? 999 : 0;

  return { totalSignals: total, wins, losses, winRate, avgRR, profitFactor, avgConfidence: avgConf, signalsToday: todaySignals, activeSignals: active, bestStrategy, byStrategy };
}

export function logEvent(type: string, message: string, metadata?: unknown): void {
  try {
    runSQL(`INSERT INTO system_events (event_type, message, metadata, timestamp) VALUES (?,?,?,?)`,
      [type, message, metadata ? JSON.stringify(metadata) : null, Date.now()]);
  } catch {
    // Non-critical
  }
}
