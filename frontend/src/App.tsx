import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, Cell, ResponsiveContainer,
} from 'recharts';
import type { TradingSignal, MarketTick, PerformanceStats, HealthStatus } from './types';
import {
  getHealth, getSignals, getPerformance, getPrices,
  generateDemoSignal, sendTelegram, registerBlockchain, simulateTP, simulateSL, runLiveAnalysis,
} from './api';
import TradingChart from './TradingChart';
import RiskManagerPanel from './components/risk/RiskManagerPanel';
import NewsIntelligencePanel from './components/news/NewsIntelligencePanel';
import NewsFeed from './components/news/NewsFeed';
import './index.css';

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatPrice(price: number, symbol: string): string {
  if (!price || isNaN(price)) return '—';
  if (symbol.includes('BTC')) return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (symbol.includes('ETH')) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

function confColor(c: number): string {
  if (c >= 90) return '#10b981';
  if (c >= 80) return '#6366f1';
  if (c >= 70) return '#f59e0b';
  return '#ef4444';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    'ACTIVE': 'badge-active',
    'TP_HIT': 'badge-tp',
    'SL_HIT': 'badge-sl',
    'EXPIRED': 'badge-expired',
    'CANCELLED': 'badge-expired',
  };
  return `badge ${map[status] ?? 'badge-expired'}`;
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ health, prices }: { health: HealthStatus | null; prices: MarketTick[] }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const svc = health?.services;

  return (
    <header style={{
      background: 'linear-gradient(90deg, #0a0c14 0%, #0d1028 50%, #0a0c14 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" style={{
              width: 36, height: 36, borderRadius: 8, objectFit: 'cover',
            }} alt="Logo" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>TradeSense AI</div>
              <div style={{ fontSize: 10, color: '#7c86a9', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Algorand Hackathon 2026</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginLeft: 16 }}>
          {prices.slice(0, 2).map(p => (
            <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#7c86a9', fontWeight: 600 }}>{p.symbol.split('/')[0]}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>${formatPrice(p.price, p.symbol)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: p.changePct24h >= 0 ? '#10b981' : '#ef4444' }}>
                {p.changePct24h >= 0 ? '+' : ''}{p.changePct24h?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
          {[
            { label: 'MARKET', status: svc?.marketData },
            { label: 'TELEGRAM', status: svc?.telegram },
            { label: 'ALGORAND', status: svc?.algorand },
          ].map(({ label, status }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div className={`status-dot ${status === 'ONLINE' ? 'online' : status === 'OFFLINE' ? 'offline' : 'degraded'}`} />
              <span style={{ color: '#7c86a9', fontWeight: 600, letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{
          fontFamily: 'monospace', fontSize: 12,
          color: '#6366f1', fontWeight: 600,
          padding: '4px 10px', background: 'rgba(99,102,241,0.1)',
          borderRadius: 6, border: '1px solid rgba(99,102,241,0.2)',
        }}>
          {time.toUTCString().slice(17, 25)} UTC
        </div>
      </div>
    </header>
  );
}

// ─── Live Signal Card ─────────────────────────────────────────────────────────
function LiveSignalCard({ signal }: { signal: TradingSignal | null }) {
  if (!signal) return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
      <div style={{ fontSize: 32 }}>📡</div>
      <div style={{ color: '#7c86a9', fontSize: 13 }}>Awaiting next signal...</div>
      <div style={{ color: '#4a5578', fontSize: 11 }}>Market scanning every 5 minutes</div>
    </div>
  );

  const isLong = signal.direction === 'LONG';
  const accentColor = isLong ? '#10b981' : '#ef4444';
  const bd = signal.confidenceBreakdown;

  return (
    <div className="card" style={{
      borderColor: `${accentColor}33`,
      boxShadow: `0 0 30px ${accentColor}15`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#7c86a9', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🔴 LIVE SIGNAL
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>{signal.symbol}</div>
          <div style={{ fontSize: 12, color: '#7c86a9', marginTop: 2 }}>{signal.strategyDisplay}</div>
        </div>
        <div style={{ display: 'flex', flex: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div className={`badge ${isLong ? 'badge-long' : 'badge-short'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {isLong ? '▲ LONG' : '▼ SHORT'}
          </div>
          <div className={statusBadge(signal.status)} style={{ marginTop: 6 }}>{signal.status}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Entry', value: `$${formatPrice(signal.entry, signal.symbol)}`, color: '#f0f4ff' },
          { label: 'Stop Loss', value: `$${formatPrice(signal.stopLoss, signal.symbol)}`, color: '#ef4444' },
          { label: 'Take Profit', value: `$${formatPrice(signal.takeProfit, signal.symbol)}`, color: '#10b981' },
          { label: 'Risk/Reward', value: `1:${signal.riskReward?.toFixed(2)}`, color: '#6366f1' },
        ].map(item => (
          <div key={item.label} style={{
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: 10, color: '#7c86a9', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Confidence bar section */}
      {bd && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#7c86a9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final Confidence</span>
            <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: confColor(signal.confidence) }}>
              {signal.confidence?.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${signal.confidence}%`, background: `linear-gradient(90deg, ${confColor(signal.confidence)}, ${confColor(signal.confidence)}99)` }} />
          </div>
          
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <div style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: '#7c86a9', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Quant Score</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: confColor(signal.quantScore) }}>{signal.quantScore?.toFixed(0) || 'N/A'}</div>
            </div>
            <div style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: '#7c86a9', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Trade Sense AI Score</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: confColor(signal.geminiScore || 0) }}>{signal.geminiScore?.toFixed(0) || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Reasons (Quant) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#7c86a9', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quant Analysis</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(signal.reasons || []).map((r, i) => (
            <span key={i} className="reason-tag">{r}</span>
          ))}
        </div>
      </div>

      {/* News Fusion Explanation */}
      {signal.newsExplanation && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#7c86a9', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>News Confluence</div>
          <div style={{ 
            padding: '10px 14px', 
            background: signal.newsExplanation.includes('CONTRADICTION') || signal.newsExplanation.includes('CONFLICT') ? 'rgba(239,68,68,0.1)' : signal.newsExplanation.includes('SUPPORT') ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${signal.newsExplanation.includes('CONTRADICTION') || signal.newsExplanation.includes('CONFLICT') ? 'rgba(239,68,68,0.2)' : signal.newsExplanation.includes('SUPPORT') ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8,
            fontSize: 12,
            color: signal.newsExplanation.includes('CONTRADICTION') || signal.newsExplanation.includes('CONFLICT') ? '#fca5a5' : signal.newsExplanation.includes('SUPPORT') ? '#6ee7b7' : '#94a3b8'
          }}>
            {signal.newsExplanation}
          </div>
        </div>
      )}

      {/* Market Structure Visualization */}
      {signal.structureFactors && signal.structureFactors.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#7c86a9', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Market Structure</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {signal.structureFactors.map((sf, i) => {
              const isBullish = sf.direction === 'BULLISH';
              const isBearish = sf.direction === 'BEARISH';
              const color = isBullish ? '#10b981' : isBearish ? '#ef4444' : '#6366f1';
              return (
                <div key={i} style={{
                  padding: '4px 8px',
                  background: `rgba(${isBullish ? '16,185,129' : isBearish ? '239,68,68' : '99,102,241'},0.1)`,
                  border: `1px solid rgba(${isBullish ? '16,185,129' : isBearish ? '239,68,68' : '99,102,241'},0.3)`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color }}>{sf.type}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#f0f4ff' }}>${sf.price.toLocaleString('en-US', {maximumFractionDigits: 2})}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {signal.algorandTxId && (
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: '#7c86a9' }}>🔗 Verified on Algorand · </span>
            <span style={{ fontFamily: 'monospace', color: '#6366f1', fontSize: 10 }}>{signal.algorandTxId.slice(0, 20)}...</span>
          </div>
          <a
            href={`https://testnet.explorer.perawallet.app/tx/${signal.algorandTxId}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}
          >
            View →
          </a>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: '#4a5578' }}>
        Signal ID: {signal.id} · {timeAgo(signal.timestamp)}
      </div>
    </div>
  );
}

// ─── Market Overview ──────────────────────────────────────────────────────────
function MarketIntelligencePanel({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-secondary)' }}>
        Loading Market Intelligence...
      </div>
    );
  }

  const { volume, liquidity } = data;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          🧠 Market Intelligence
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume Engine</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>RVOL</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: volume.rvol >= 1.5 ? 'var(--color-long)' : 'var(--text-primary)' }}>
              {volume.rvol.toFixed(2)}x
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>State</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{volume.volumeState}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Spike Detected</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: volume.volumeSpike ? 'var(--color-long)' : 'var(--text-secondary)' }}>
              {volume.volumeSpike ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liquidity Engine</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nearest Pool</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: liquidity.nearestPool === 'BSL' ? 'var(--color-long)' : 'var(--color-short)' }}>
              {liquidity.nearestPool || 'None'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Unmitigated BSL</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{liquidity.bsl.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Unmitigated SSL</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{liquidity.ssl.length}</span>
          </div>
        </div>
      </div>
      
      {liquidity.sweeps && liquidity.sweeps.length > 0 && (
        <div style={{ marginTop: 8, padding: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-long)' }}>💧 Liquidity Sweep Detected</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {liquidity.sweeps[0].type} at {liquidity.sweeps[0].liquidityLevel.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketOverview({ prices, health }: { prices: MarketTick[], health: HealthStatus | null }) {
  const marketStatus = health?.market?.status || 'OFFLINE';
  const isLive = marketStatus === 'LIVE';
  const isReconn = marketStatus === 'RECONNECTING';

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="card-title">🌍 Market Overview</div>
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
          background: isLive ? 'rgba(16,185,129,0.1)' : isReconn ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
          color: isLive ? '#10b981' : isReconn ? '#f59e0b' : '#ef4444',
          border: `1px solid ${isLive ? 'rgba(16,185,129,0.3)' : isReconn ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`
        }}>
          {isLive ? '🟢 LIVE' : isReconn ? '🟡 RECONNECTING' : '🔴 OFFLINE'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {prices.map(p => {
          const isUp = p.changePct24h >= 0;
          return (
            <div key={p.symbol} style={{
              padding: '12px',
              background: isUp ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
              borderRadius: 8,
              border: `1px solid ${isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f4ff' }}>{p.symbol}</span>
                <span style={{ fontSize: 11, color: isUp ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {isUp ? '▲' : '▼'} {Math.abs(p.changePct24h ?? 0).toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', marginBottom: 6 }}>
                ${formatPrice(p.price, p.symbol)}
              </div>
              <div style={{ fontSize: 10, color: '#4a5578' }}>
                Vol: {(p.volume24h / 1_000_000).toFixed(1)}M
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Signal Feed ──────────────────────────────────────────────────────────────
function SignalFeed({ signals }: { signals: TradingSignal[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📋 Signal Feed</div>
        <span style={{ fontSize: 11, color: '#7c86a9' }}>{signals.length} signals</span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Asset</th>
              <th>Direction</th>
              <th>Entry</th>
              <th>SL</th>
              <th>TP</th>
              <th>Conf</th>
              <th>RR</th>
              <th>Status</th>
              <th>AI</th>
              <th>Chain</th>
            </tr>
          </thead>
          <tbody>
            {signals.map(s => (
              <tr key={s.id}>
                <td style={{ color: '#4a5578', fontFamily: 'monospace', fontSize: 11 }}>{timeAgo(s.timestamp)}</td>
                <td style={{ fontWeight: 700, color: '#f0f4ff' }}>{s.symbol}</td>
                <td>
                  <span className={`badge ${s.direction === 'LONG' ? 'badge-long' : 'badge-short'}`}>
                    {s.direction}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>${formatPrice(s.entry, s.symbol)}</td>
                <td style={{ fontFamily: 'monospace', color: '#ef4444' }}>${formatPrice(s.stopLoss, s.symbol)}</td>
                <td style={{ fontFamily: 'monospace', color: '#10b981' }}>${formatPrice(s.takeProfit, s.symbol)}</td>
                <td>
                  <span style={{ fontWeight: 700, color: confColor(s.confidence), fontFamily: 'monospace' }}>
                    {s.confidence?.toFixed(0)}%
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>1:{s.riskReward?.toFixed(1)}</td>
                <td><span className={statusBadge(s.status)}>{s.status}</span></td>
                <td>
                  <span title={s.aiExplanation || "No AI reasoning available"} style={{ cursor: 'help', fontSize: '14px' }}>
                    🤖
                  </span>
                </td>
                <td>
                  {s.algorandTxId ? (
                    <a
                      href={`https://testnet.explorer.perawallet.app/tx/${s.algorandTxId}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: '#6366f1', fontSize: 10, fontWeight: 600 }}
                    >
                      ✓ Verified
                    </a>
                  ) : (
                    <span style={{ color: '#4a5578', fontSize: 10 }}>Pending</span>
                  )}
                </td>
              </tr>
            ))}
            {signals.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: '#4a5578', padding: '32px' }}>
                  No signals yet. Use the Demo Panel to generate one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Performance Panel ────────────────────────────────────────────────────────
function PerformancePanel({ stats }: { stats: PerformanceStats | null }) {
  if (!stats) return null;

  const chartData = [
    { name: 'Win Rate', value: stats.winRate, fill: '#10b981' },
    { name: 'Avg RR', value: Math.min(100, stats.avgRR * 30), fill: '#6366f1' },
    { name: 'Confidence', value: stats.avgConfidence, fill: '#f59e0b' },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📈 Performance</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Win Rate</div>
          <div className={`stat-value ${stats.winRate >= 50 ? 'green' : 'red'}`}>{stats.winRate.toFixed(1)}%</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Signals</div>
          <div className="stat-value">{stats.totalSignals}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Profit Factor</div>
          <div className={`stat-value ${stats.profitFactor >= 1 ? 'green' : 'red'}`}>{stats.profitFactor.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Wins</div>
          <div className="stat-value green">{stats.wins}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Losses</div>
          <div className="stat-value red">{stats.losses}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Today</div>
          <div className="stat-value accent">{stats.signalsToday}</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={chartData}>
          <Bar dataKey="value" radius={4}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 12, fontSize: 11, color: '#7c86a9' }}>
        🏆 Best Strategy: <strong style={{ color: '#6366f1' }}>{stats.bestStrategy.replace(/_/g, ' ')}</strong>
        &nbsp;· Avg Confidence: <strong style={{ color: '#f59e0b' }}>{stats.avgConfidence.toFixed(1)}%</strong>
        &nbsp;· Active: <strong style={{ color: '#10b981' }}>{stats.activeSignals}</strong>
      </div>
    </div>
  );
}

// ─── Blockchain Verification ──────────────────────────────────────────────────
function BlockchainVerification({ health, latestSignal }: { health: HealthStatus | null; latestSignal: TradingSignal | null }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">⛓️ Blockchain Verification</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={`status-dot ${health?.algorand?.connected ? 'online' : 'offline'}`} />
          <span style={{ fontSize: 11, color: '#7c86a9' }}>{health?.algorand?.network ?? 'testnet'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 10, color: '#7c86a9', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Application ID</div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#6366f1' }}>
            {health?.algorand?.appId ?? 1008}
          </div>
        </div>
        <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 10, color: '#7c86a9', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Network</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff' }}>Algorand Testnet</div>
        </div>
      </div>

      {latestSignal?.algorandTxId ? (
        <div style={{ padding: '12px', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginBottom: 6 }}>✓ Latest Verified Transaction</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#7c86a9', marginBottom: 8, wordBreak: 'break-all' }}>
            {latestSignal.algorandTxId}
          </div>
          <a
            href={`https://testnet.explorer.perawallet.app/tx/${latestSignal.algorandTxId}`}
            target="_blank" rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: 11, display: 'inline-flex', textDecoration: 'none' }}
          >
            🔗 View on Explorer
          </a>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#4a5578', textAlign: 'center', padding: 20 }}>
          Generate a signal to see blockchain verification
        </div>
      )}

      {health?.algorand?.lastTxId && health.algorand.lastTxId !== latestSignal?.algorandTxId && (
        <div style={{ marginTop: 10, fontSize: 10, color: '#4a5578' }}>
          Last Tx: <span style={{ fontFamily: 'monospace', color: '#6366f1' }}>{health.algorand.lastTxId.slice(0, 30)}...</span>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Status ──────────────────────────────────────────────────────────
function TelegramStatus({ health }: { health: HealthStatus | null }) {
  const tg = health?.telegram;
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📱 Telegram</div>
        <div className={`status-dot ${tg?.connected ? 'online' : 'offline'}`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="stat">
          <div className="stat-label">Messages Sent</div>
          <div className="stat-value accent">{tg?.totalMessagesSent ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Subscribers</div>
          <div className="stat-value">{tg?.subscribers ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Errors</div>
          <div className={`stat-value ${(tg?.errors ?? 0) > 0 ? 'red' : 'green'}`}>{tg?.errors ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Status</div>
          <div className={`stat-value ${tg?.connected ? 'green' : 'red'}`} style={{ fontSize: 14 }}>
            {tg?.connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Judge Demo Panel ─────────────────────────────────────────────────────────
type PipelineStage = 'idle' | 'market' | 'analysis' | 'signal' | 'algorand' | 'telegram' | 'outcome' | 'done';

function JudgeDemoPanel({ onSignalGenerated }: { onSignalGenerated: (s: TradingSignal) => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [lastSignalId, setLastSignalId] = useState<string | undefined>();
  const [status, setStatus] = useState('Ready for demo');
  const [symbol, setSymbol] = useState('BTC/USDT');

  const stages: { id: PipelineStage; label: string; emoji: string }[] = [
    { id: 'market', label: 'Market', emoji: '📊' },
    { id: 'analysis', label: 'AI Analysis', emoji: '🤖' },
    { id: 'signal', label: 'Signal', emoji: '📡' },
    { id: 'algorand', label: 'Algorand', emoji: '⛓️' },
    { id: 'telegram', label: 'Telegram', emoji: '📱' },
    { id: 'outcome', label: 'Outcome', emoji: '🎯' },
  ];

  const setProgress = (s: PipelineStage, msg: string) => {
    setStage(s);
    setStatus(msg);
  };

  const demoFlow = async () => {
    setLoading('demo');
    try {
      setProgress('market', 'Fetching live market data...');
      await new Promise(r => setTimeout(r, 600));

      setProgress('analysis', 'Running AI analysis (ICT/SMC + Technical)...');
      await new Promise(r => setTimeout(r, 800));

      setProgress('signal', 'Generating signal...');
      const sig = await generateDemoSignal(symbol);
      setLastSignalId(sig.id);
      onSignalGenerated(sig);

      setProgress('algorand', 'Registering on Algorand blockchain...');
      await registerBlockchain(sig.id);
      await new Promise(r => setTimeout(r, 500));

      setProgress('telegram', 'Broadcasting via Telegram...');
      await sendTelegram(sig.id);
      await new Promise(r => setTimeout(r, 400));

      setProgress('done', `✅ Demo complete! Signal ${sig.id} generated & verified`);
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const triggerTP = async () => {
    setLoading('tp');
    try {
      const sig = await simulateTP(lastSignalId);
      onSignalGenerated(sig);
      setStatus(`✅ Take Profit hit! Signal ${sig.id} → WIN`);
      setStage('outcome');
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const triggerSL = async () => {
    setLoading('sl');
    try {
      const sig = await simulateSL(lastSignalId);
      onSignalGenerated(sig);
      setStatus(`❌ Stop Loss hit. Signal ${sig.id} → LOSS`);
      setStage('outcome');
    } catch (err) {
      setStatus(`Error: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const liveAnalysis = async () => {
    setLoading('live');
    try {
      setProgress('market', 'Running live market analysis...');
      const sig = await runLiveAnalysis(symbol);
      if (sig) {
        setLastSignalId(sig.id);
        onSignalGenerated(sig);
        setProgress('done', `✅ Live signal generated: ${sig.direction} ${sig.symbol}`);
      } else {
        setStatus('No signal conditions met right now.');
        setStage('idle');
      }
    } catch (err: any) {
      if (err.response?.data?.stage) {
        const apiErr = err.response.data;
        setStatus(`Error [${apiErr.stage}]: ${apiErr.error}. ${apiErr.details || ''}`);
      } else {
        setStatus(`Error: ${err.message || String(err)}`);
      }
      setStage('idle');
    } finally {
      setLoading(null);
    }
  };

  const reset = () => {
    setStage('idle');
    setLastSignalId(undefined);
    setStatus('Ready for demo');
  };

  const activeStageIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className="card" style={{
      borderColor: 'rgba(99,102,241,0.3)',
      boxShadow: '0 0 30px rgba(99,102,241,0.1)',
    }}>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f0f4ff' }}>HACKATHON LIVE DEMO</div>
            <div style={{ fontSize: 11, color: '#7c86a9' }}>Complete pipeline demonstration for judges</div>
          </div>
        </div>
        <div>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: '#f0f4ff',
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <option value="BTC/USDT">BTC/USDT</option>
            <option value="ETH/USDT">ETH/USDT</option>
            <option value="SOL/USDT">SOL/USDT</option>
            <option value="BNB/USDT">BNB/USDT</option>
          </select>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {stages.map((s, i) => {
          const isActive = activeStageIndex === i;
          const isDone = activeStageIndex > i || stage === 'done';
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                  border: `2px solid ${isDone ? '#10b981' : isActive ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                  background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                  transition: 'all 0.3s',
                  boxShadow: isDone ? '0 0 12px rgba(16,185,129,0.3)' : isActive ? '0 0 12px rgba(245,158,11,0.3)' : 'none',
                }}>
                  {isDone ? '✓' : s.emoji}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDone ? '#10b981' : isActive ? '#f59e0b' : '#4a5578' }}>
                  {s.label}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div style={{ width: 24, height: 2, background: isDone ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.06)', marginBottom: 16 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Status */}
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 12, color: '#7c86a9', marginBottom: 16, minHeight: 38,
      }}>
        {status}
      </div>

      {/* Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        <button className="btn btn-primary" onClick={demoFlow} disabled={!!loading}>
          {loading === 'demo' ? '⏳' : '🚀'} Full Demo
        </button>
        <button className="btn btn-secondary" onClick={liveAnalysis} disabled={!!loading}>
          {loading === 'live' ? '⏳' : '📡'} Live Analysis
        </button>
        <button className="btn btn-secondary" onClick={() => sendTelegram(lastSignalId)} disabled={!!loading}>
          {loading === 'tg' ? '⏳' : '📱'} Send Telegram
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <button className="btn btn-green" onClick={triggerTP} disabled={!!loading || !lastSignalId}>
          {loading === 'tp' ? '⏳' : '✅'} Simulate TP
        </button>
        <button className="btn btn-red" onClick={triggerSL} disabled={!!loading || !lastSignalId}>
          {loading === 'sl' ? '⏳' : '❌'} Simulate SL
        </button>
        <button className="btn btn-secondary" onClick={reset}>
          🔄 Reset
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [prices, setPrices] = useState<MarketTick[]>([]);
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [marketIntelligence, setMarketIntelligence] = useState<Record<string, any>>({});
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [h, sigs, perf, prs] = await Promise.all([
        getHealth().catch(() => null),
        getSignals(30).catch(() => []),
        getPerformance().catch(() => null),
        getPrices().catch(() => []),
      ]);
      if (h) setHealth(h);
      setSignals(sigs);
      if (perf) setPerformance(perf);
      setPrices(prs);
      
      // Load initial intelligence for primary symbol (BTC/USDT or first one)
      if (prs.length > 0) {
        const primarySymbol = prs[0].symbol;
        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        fetch(`${API_BASE}/market/${encodeURIComponent(primarySymbol)}/analysis`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setMarketIntelligence(prev => ({ ...prev, [primarySymbol]: data.data }));
            }
          })
          .catch(() => {});
      }
    } catch { /* continue */ }
  }, []);

  // SSE connection
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const es = new EventSource(`${API_BASE}/events`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data);
        if (event.type === 'MARKET_INTELLIGENCE' && event.data) {
          setMarketIntelligence(prev => ({
            ...prev,
            [event.data.symbol]: event.data
          }));
        }
        if (event.type === 'SIGNAL' || event.type === 'STATUS_UPDATE') {
          setSignals(prev => {
            const idx = prev.findIndex(s => s.id === event.data.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = event.data;
              return updated;
            }
            return [event.data, ...prev].slice(0, 50);
          });
        }
        if (event.type === 'LIVE_PROGRESS' && event.data) {
          setProgress(event.data.stage as PipelineStage, event.data.message);
        }
        if (event.type === 'PRICE_UPDATE' && Array.isArray(event.data)) {
          setPrices(prev => {
            const updated = [...prev];
            (event.data as MarketTick[]).forEach(newTick => {
              const idx = updated.findIndex(p => p.symbol === newTick.symbol);
              if (idx >= 0) updated[idx] = newTick;
              else updated.push(newTick);
            });
            return updated;
          });
        }
        if (event.type === 'MARKET_STATUS' && event.data) {
          setHealth(prev => prev ? { ...prev, market: event.data as any } : null);
        }
        if (event.type === 'PERFORMANCE') {
          setPerformance(event.data);
        }
      } catch { /* ignore */ }
    };

    return () => es.close();
  }, []);

  // Periodic data refresh
  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 30_000);
    return () => clearInterval(t);
  }, [loadData]);

  const handleSignalGenerated = useCallback((sig: TradingSignal) => {
    setSignals(prev => {
      const idx = prev.findIndex(s => s.id === sig.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = sig;
        return updated;
      }
      return [sig, ...prev].slice(0, 50);
    });
    // Refresh performance
    getPerformance().then(p => { if (p) setPerformance(p); }).catch(() => {});
  }, []);

  const latestSignal = signals[0] ?? null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header health={health} prices={prices} />

      <main className="container" style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
        {/* Connection banner */}
        {!connected && (
          <div style={{
            padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 8, fontSize: 12, color: '#f59e0b', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚠️ Connecting to backend... Make sure the server is running on port 3001.
          </div>
        )}

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Left Column (2fr) */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <LiveSignalCard signal={latestSignal} />
              </div>
            </div>

            {/* Market Intelligence Row */}
            {prices.length > 0 && marketIntelligence[prices[0].symbol] && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <MarketIntelligencePanel data={marketIntelligence[prices[0].symbol]} />
                <TradingChart symbol={prices[0].symbol} />
              </div>
            )}
            
            {/* News Intelligence Row */}
            {prices.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <NewsIntelligencePanel symbol={prices[0].symbol} />
                <NewsFeed symbol={prices[0].symbol} />
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <JudgeDemoPanel onSignalGenerated={handleSignalGenerated} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <MarketOverview prices={prices} health={health} />
                <BlockchainVerification health={health} latestSignal={signals.find(s => s.algorandTxId) ?? null} />
                <TelegramStatus health={health} />
              </div>
            </div>
            
            <PerformancePanel stats={performance} />
            <SignalFeed signals={signals} />
          </div>

          {/* Right Column (1fr) - Risk Manager */}
          <div>
            <RiskManagerPanel signal={latestSignal} isLoading={!connected && signals.length === 0} />
          </div>
        </div>
      </main>

      {/* Floating connection badge */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 100,
        background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        fontSize: 11, fontWeight: 600,
        color: connected ? '#10b981' : '#ef4444',
        zIndex: 100,
      }}>
        <div className={`status-dot ${connected ? 'online' : 'offline'}`} />
        {connected ? 'Live' : 'Disconnected'}
      </div>
    </div>
  );
}
