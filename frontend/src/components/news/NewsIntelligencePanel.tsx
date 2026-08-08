import { useEffect, useState } from 'react';
import type { NewsBiasData } from '../../types';

interface Props {
  symbol: string;
}

export default function NewsIntelligencePanel({ symbol }: Props) {
  const [data, setData] = useState<NewsBiasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchNews() {
      try {
        setLoading(true);
        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${API_BASE}/news/${encodeURIComponent(symbol)}`);
        const json = await res.json();
        
        if (mounted) {
          if (json.success && json.data) {
            setData(json.data);
            setError(null);
          } else {
            setError(json.error || 'Failed to load news');
          }
        }
      } catch (err) {
        if (mounted) setError('Error fetching news data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchNews();
    const t = setInterval(fetchNews, 60_000); // refresh every minute

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [symbol]);

  if (loading && !data) {
    return (
      <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading News Intelligence...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', minHeight: 200 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📰 AI News Intelligence
        </div>
        <div style={{ color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⚠️</span> DATA UNAVAILABLE
        </div>
      </div>
    );
  }


  
  let scoreColor = '#94a3b8';
  if (data.biasScore >= 30) scoreColor = '#10b981';
  if (data.biasScore >= 70) scoreColor = '#059669';
  if (data.biasScore <= -30) scoreColor = '#ef4444';
  if (data.biasScore <= -70) scoreColor = '#dc2626';

  return (
    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', justifyContent: 'space-between' }}>
        <span>📰 AI News Intelligence</span>
        <span style={{ color: '#fff' }}>{symbol}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Bias Score */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>NEWS BIAS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: scoreColor, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {data.biasScore > 0 ? '+' : ''}{data.biasScore}
            <span style={{ fontSize: 11, fontWeight: 600 }}>
              {data.biasStatus.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Impact & Confidence */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
             <span style={{ color: '#64748b' }}>Impact:</span>
             <span style={{ 
               color: data.impact === 'CRITICAL' ? '#ef4444' : data.impact === 'HIGH' ? '#f59e0b' : '#10b981',
               fontWeight: 600
             }}>{data.impact}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
             <span style={{ color: '#64748b' }}>Confidence:</span>
             <span style={{ color: '#fff', fontWeight: 600 }}>{data.confidence}%</span>
           </div>
        </div>
      </div>

      {data.hasConflict && (
        <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8, color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span> CONFLICTING NEWS DETECTED
        </div>
      )}

      {/* Aggregate Stats */}
      <div>
        <div style={{ fontSize: 12, color: '#fff', marginBottom: 6 }}>{data.newsCount} relevant articles</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
          <span style={{ color: data.bullishNewsCount > 0 ? '#10b981' : undefined }}>{data.bullishNewsCount} Bullish</span>
          <span>|</span>
          <span style={{ color: data.neutralNewsCount > 0 ? '#94a3b8' : undefined }}>{data.neutralNewsCount} Neutral</span>
          <span>|</span>
          <span style={{ color: data.bearishNewsCount > 0 ? '#ef4444' : undefined }}>{data.bearishNewsCount} Bearish</span>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Latest Headline */}
      {data.articles.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>LATEST IMPORTANT EVENT</div>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>
            "{data.articles[0].title}"
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {data.articles[0].source} • {Math.floor((Date.now() - data.articles[0].publishedAt) / 60000)} min ago
          </div>
        </div>
      )}

      {/* Effect Badge */}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Effect:</span>
        <span style={{ 
          fontSize: 11, 
          fontWeight: 600,
          color: data.signalEffect.includes('SUPPORTS') ? '#10b981' : data.signalEffect.includes('CONTRADICTS') ? '#ef4444' : '#94a3b8'
        }}>
          {data.signalEffect.includes('SUPPORTS') ? '✓' : data.signalEffect.includes('CONTRADICTS') ? '⚠️' : '⚪'} {data.signalEffect.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}
