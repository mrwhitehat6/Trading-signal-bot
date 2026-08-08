import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';


interface TradingChartProps {
  symbol: string;
}

export default function TradingChart({ symbol }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#7c86a9',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
      }
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candlestickSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // set as an overlay by setting a blank priceScaleId
    });
    
    // Scale volume to bottom 20% of chart
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // Fetch data
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/market/${encodeURIComponent(symbol)}/analysis`);
        const result = await res.json();
        
        // Let's actually fetch historical OHLCV instead since /analysis doesn't return raw candles
        // But since we don't have a direct raw candles API, let's fetch it via another endpoint or modify API
        // Wait, I can just fetch it directly or I will create an endpoint for OHLCV
        // Or I can just fetch it from Binance in the frontend for demo purposes if backend doesn't have it.
        // Let's add a quick fetch to Binance REST directly for the chart.
        let fetchSymbol = symbol;
        if (symbol === 'BTC/USDT') fetchSymbol = 'BTCUSDT';
        if (symbol === 'ETH/USDT') fetchSymbol = 'ETHUSDT';
        if (symbol === 'SOL/USDT') fetchSymbol = 'SOLUSDT';
        if (symbol === 'BNB/USDT') fetchSymbol = 'BNBUSDT';
        
        if (fetchSymbol.endsWith('USDT')) {
          const klinesRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${fetchSymbol}&interval=1m&limit=200`);
          const klinesData = await klinesRes.json();
          
          // Offset time by 5.5 hours (19800 seconds) to display IST in UTC-based chart
          const IST_OFFSET = 19800;

          const chartData = klinesData.map((d: any) => ({
            time: (d[0] / 1000 + IST_OFFSET) as Time,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
          }));
          const volData = klinesData.map((d: any) => ({
            time: (d[0] / 1000 + IST_OFFSET) as Time,
            value: parseFloat(d[5]),
            color: parseFloat(d[4]) >= parseFloat(d[1]) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
          }));

          candlestickSeries.setData(chartData);
          volumeSeries.setData(volData);
        }

        // Draw Liquidity Overlays
        if (result.success && result.data && result.data.liquidity) {
          const bsl = result.data.liquidity.bsl;
          const ssl = result.data.liquidity.ssl;
          
          bsl.slice(0, 3).forEach((l: any) => {
            candlestickSeries.createPriceLine({
              price: l.price,
              color: 'rgba(239, 68, 68, 0.6)',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'BSL',
            });
          });

          ssl.slice(0, 3).forEach((l: any) => {
            candlestickSeries.createPriceLine({
              price: l.price,
              color: 'rgba(16, 185, 129, 0.6)',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              title: 'SSL',
            });
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol]);

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📊 Live Chart ({symbol})</h2>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading data...</span>}
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />
    </div>
  );
}
