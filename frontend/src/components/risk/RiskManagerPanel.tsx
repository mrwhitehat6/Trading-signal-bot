import type { TradingSignal, RiskProfile } from '../../types';

interface Props {
  signal: TradingSignal | null;
  isLoading?: boolean;
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RiskManagerPanel({ signal, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="risk-panel-container">
        <div className="panel-header">
          <h2>AI RISK MANAGER</h2>
          <div className="status-indicator yellow">● ANALYZING</div>
        </div>
        <div className="loading-state" style={{ padding: 40, textAlign: 'center', color: '#7c86a9' }}>
          <p>Analyzing market...</p>
          <p>Risk engine: <span style={{ color: '#f59e0b' }}>● CALCULATING</span></p>
          <p>Gemini: <span style={{ color: '#f59e0b' }}>● ANALYZING</span></p>
          <p>Final decision: <span>WAITING</span></p>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="risk-panel-container">
        <div className="panel-header">
          <h2>AI RISK MANAGER</h2>
          <div className="status-indicator gray">⚪ WAITING FOR SIGNAL</div>
        </div>
        <div className="empty-state" style={{ padding: 40, textAlign: 'center', color: '#7c86a9' }}>
          No active signal to analyze.
        </div>
      </div>
    );
  }

  const risk = signal.riskFactors as RiskProfile;
  
  if (!risk) {
    return (
      <div className="risk-panel-container">
        <div className="panel-header">
          <h2>AI RISK MANAGER</h2>
          <div className="status-indicator red">🔴 ERROR</div>
        </div>
        <div className="error-state" style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
          RISK ENGINE ERROR<br />
          <span style={{ fontSize: 12, color: '#7c86a9' }}>Risk details missing from signal.</span>
        </div>
      </div>
    );
  }

  const isApproved = risk.decision === 'APPROVED';
  const isCaution = risk.decision === 'CAUTION';
  const decisionColor = isApproved ? '#10b981' : isCaution ? '#f59e0b' : '#ef4444';
  const decisionIcon = isApproved ? '✓' : isCaution ? '⚠' : '✕';

  return (
    <div className="risk-panel-container" style={{
      background: 'linear-gradient(180deg, #10121e 0%, #0d0f18 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto'
    }}>
      {/* 1. PANEL NAME */}
      <div className="panel-header" style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.05em' }}>AI RISK MANAGER</div>
          <div style={{ fontSize: 10, color: '#7c86a9' }}>Real-time trade validation & capital protection</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
          ● RISK ENGINE ACTIVE
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* 2. MAIN DECISION */}
        <div style={{
          border: `1px solid ${decisionColor}40`,
          background: `${decisionColor}10`,
          borderRadius: 12,
          padding: 20,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>TRADE DECISION</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: decisionColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {decisionIcon} {risk.decision}
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
            <div><span style={{ color: '#7c86a9' }}>Risk Score:</span> <strong>{risk.riskScore} / 100</strong></div>
            <div><span style={{ color: '#7c86a9' }}>Risk Level:</span> <strong style={{ color: risk.riskLevel === 'LOW' ? '#10b981' : risk.riskLevel === 'MEDIUM' ? '#f59e0b' : '#ef4444' }}>{risk.riskLevel}</strong></div>
          </div>
        </div>

        {/* 4. RISK/REWARD & 5. CAPITAL RISK */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>RISK / REWARD</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: '#6366f1', marginBottom: 12 }}>
              1 : {risk.riskReward.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7c86a9' }}>Entry</span> <span style={{ fontFamily: 'monospace' }}>${formatPrice(signal.entry)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7c86a9' }}>Stop Loss</span> <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>${formatPrice(signal.stopLoss)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7c86a9' }}>Target</span> <span style={{ fontFamily: 'monospace', color: '#10b981' }}>${formatPrice(signal.takeProfit)}</span></div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>CAPITAL RISK</div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7c86a9' }}>Account Balance</span> <span style={{ fontFamily: 'monospace' }}>{formatMoney(risk.accountBalance)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7c86a9' }}>Risk / Trade</span> <span style={{ fontFamily: 'monospace' }}>{risk.riskPercent.toFixed(1)}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7c86a9' }}>Maximum Loss</span> <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatMoney(risk.riskAmount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#7c86a9', fontWeight: 600 }}>Rec. Position</span> 
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#3b82f6' }}>{risk.positionSize.toFixed(4)} {signal.symbol.split('/')[0]}</span>
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* 7. VOLATILITY & 8. LIQUIDITY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>VOLATILITY</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: risk.volatility.level === 'EXTREME' ? '#ef4444' : risk.volatility.level === 'HIGH' ? '#f59e0b' : '#10b981' }}>{risk.volatility.level}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#94a3b8' }}>ATR: ${formatPrice(risk.volatility.atr)}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>ATR %: {risk.volatility.atrPercent.toFixed(2)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>LIQUIDITY</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: risk.liquidity.level === 'LOW' ? '#ef4444' : risk.liquidity.level === 'MODERATE' ? '#f59e0b' : '#10b981' }}>{risk.liquidity.level}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#94a3b8' }}>24h Vol: {formatMoney(risk.liquidity.volume24h)}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Spread: {risk.liquidity.spreadPercent.toFixed(2)}%</div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* 6. RISK FACTORS */}
        <div>
          <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>RISK FACTORS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c86a9' }}>Market Structure</span>
              <span>{risk.factors.marketStructure === 'BULLISH' ? '🟢' : risk.factors.marketStructure === 'BEARISH' ? '🔴' : '🟡'} {risk.factors.marketStructure}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c86a9' }}>Volume</span>
              <span>{risk.factors.volume === 'LOW' ? '🟡' : '🟢'} {risk.factors.volume}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c86a9' }}>Momentum</span>
              <span>{risk.factors.momentum === 'POSITIVE' ? '🟢' : '🔴'} {risk.factors.momentum}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c86a9' }}>Trend</span>
              <span>{risk.factors.trend === 'SIDEWAYS' ? '🟡' : risk.factors.trend === 'BULLISH' ? '🟢' : '🔴'} {risk.factors.trend}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#7c86a9' }}>AI Confidence</span>
              <span>{signal.confidence >= 80 ? '🟢' : signal.confidence >= 60 ? '🟡' : '🔴'} {signal.confidence}%</span>
            </div>
          </div>
        </div>

        {/* 11. AI RISK ANALYSIS */}
        <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤖</span> AI RISK ANALYSIS
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {risk.aiExplanation}
          </div>
        </div>

        {/* 12. RISK WARNINGS */}
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>RISK WARNINGS</div>
          {risk.warnings.length === 0 ? (
            <div style={{ fontSize: 12, color: '#10b981' }}>✓ No major risk violations detected</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#ef4444' }}>
              {risk.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
        </div>

        {/* 13. HARD RISK RULES */}
        <div>
          <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>RISK CHECKS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div style={{ color: risk.checks.riskReward ? '#10b981' : '#ef4444' }}>{risk.checks.riskReward ? '✓' : '✕'} Risk / Reward</div>
            <div style={{ color: risk.checks.stopLoss ? '#10b981' : '#ef4444' }}>{risk.checks.stopLoss ? '✓' : '✕'} Stop Loss</div>
            <div style={{ color: risk.checks.positionSize ? '#10b981' : '#ef4444' }}>{risk.checks.positionSize ? '✓' : '✕'} Position Size</div>
            <div style={{ color: risk.checks.liquidity ? '#10b981' : '#ef4444' }}>{risk.checks.liquidity ? '✓' : '✕'} Liquidity</div>
            <div style={{ color: risk.checks.volatility ? '#10b981' : '#ef4444' }}>{risk.checks.volatility ? '✓' : '✕'} Volatility</div>
            <div style={{ color: risk.checks.confidence ? '#10b981' : '#ef4444' }}>{risk.checks.confidence ? '✓' : '✕'} Confidence</div>
            <div style={{ color: risk.checks.drawdown ? '#10b981' : '#ef4444' }}>{risk.checks.drawdown ? '✓' : '✕'} Drawdown</div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* 14. FINAL VERDICT */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#7c86a9', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>FINAL RISK VERDICT</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: decisionColor, marginBottom: 4 }}>
            {decisionIcon} TRADE {risk.decision}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {isApproved ? 'All mandatory risk constraints satisfied.' : 'Failed to satisfy risk constraints.'}
          </div>
        </div>

        {/* 15. SIGNAL INFORMATION & 16. BLOCKCHAIN STATUS */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 8, fontSize: 11, color: '#7c86a9' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>CURRENT SIGNAL</div>
            <div>{signal.symbol} | {signal.direction}</div>
            <div>ID: <span style={{ fontFamily: 'monospace' }}>{signal.id}</span></div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>BLOCKCHAIN VERIFICATION</div>
            {signal.algorandTxId ? (
              <>
                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>● ALGORAND VERIFIED</div>
                <div>App ID: {signal.algorandAppId}</div>
                <div>Tx: <a href={`https://testnet.algoexplorer.io/tx/${signal.algorandTxId}`} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>{signal.algorandTxId.substring(0, 16)}...</a></div>
              </>
            ) : (
              <div style={{ color: '#f59e0b' }}>WAITING FOR VERIFICATION</div>
            )}
          </div>
        </div>
        
        {/* 17. REAL-TIME UPDATES */}
        <div style={{ textAlign: 'center', fontSize: 10, color: '#64748b' }}>
          Updated {new Date(signal.timestamp).toLocaleTimeString()} • AI-generated decision support — not financial advice.
        </div>

      </div>
    </div>
  );
}
