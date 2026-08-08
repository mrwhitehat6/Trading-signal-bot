import { useEffect, useState } from 'react';
import type { NewsBiasData } from '../../types';

interface Props {
  symbol: string;
}

export default function NewsFeed({ symbol }: Props) {
  const [data, setData] = useState<NewsBiasData | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchNews() {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${API_BASE}/news/${encodeURIComponent(symbol)}`);
        const json = await res.json();
        if (mounted && json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        // ignore
      }
    }

    fetchNews();
    const t = setInterval(fetchNews, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [symbol]);

  if (!data || data.articles.length === 0) {
    return (
      <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: 13 }}>No recent news for {symbol}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Live News Feed
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
        {data.articles.map(article => {
          const isBullish = article.analysis?.sentiment === 'BULLISH';
          const isBearish = article.analysis?.sentiment === 'BEARISH';
          
          return (
            <div key={article.id} style={{ 
              background: 'var(--bg-secondary)', 
              borderRadius: 8, 
              padding: 12, 
              border: `1px solid ${isBullish ? 'rgba(16, 185, 129, 0.1)' : isBearish ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <a href={article.url} target="_blank" rel="noreferrer" style={{ color: '#fff', fontSize: 13, fontWeight: 500, lineHeight: 1.4, textDecoration: 'none' }}>
                  {article.title}
                </a>
                <div style={{ 
                  fontSize: 10, 
                  fontWeight: 600, 
                  padding: '2px 6px', 
                  borderRadius: 4,
                  background: isBullish ? 'rgba(16, 185, 129, 0.1)' : isBearish ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                  color: isBullish ? '#10b981' : isBearish ? '#ef4444' : '#94a3b8'
                }}>
                  {article.analysis?.sentiment || 'UNKNOWN'}
                </div>
              </div>
              
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {article.description}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span>{article.source}</span>
                  <span>•</span>
                  <span>{Math.floor((Date.now() - article.publishedAt) / 60000)}m ago</span>
                </div>
                {article.analysis && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span>Impact: <span style={{ color: article.analysis.impact === 'HIGH' || article.analysis.impact === 'CRITICAL' ? '#f59e0b' : '#64748b' }}>{article.analysis.impact}</span></span>
                    <span>Bias: {article.analysis.biasScore}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
