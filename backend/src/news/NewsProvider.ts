import type { NewsArticle } from '../types';

export interface NewsProvider {
  fetchNews(assets: string[]): Promise<NewsArticle[]>;
}

export class MockNewsProvider implements NewsProvider {
  async fetchNews(assets: string[]): Promise<NewsArticle[]> {
    const now = Date.now();
    // Simulate some articles
    const articles: NewsArticle[] = [];

    if (assets.includes('BTC') || assets.includes('BTC/USDT')) {
      articles.push({
        id: `mock-btc-1-${now}`,
        title: 'Bitcoin ETF sees record inflows',
        description: 'Institutional demand for Bitcoin continues to grow as ETFs see record inflows over the past week.',
        url: 'https://example.com/btc-etf',
        source: 'Reuters',
        publishedAt: now - 1000 * 60 * 30, // 30 mins ago
        fetchedAt: now,
        assets: ['BTC', 'BTC/USDT'],
        category: 'Finance'
      });
      articles.push({
        id: `mock-btc-2-${now}`,
        title: 'Regulatory scrutiny on crypto exchanges increases',
        description: 'Global regulators are teaming up to enforce stricter KYC and AML rules on major cryptocurrency exchanges.',
        url: 'https://example.com/crypto-reg',
        source: 'Bloomberg',
        publishedAt: now - 1000 * 60 * 60 * 2, // 2 hours ago
        fetchedAt: now,
        assets: ['BTC', 'ETH', 'BTC/USDT'],
        category: 'Regulation'
      });
    }

    if (assets.includes('NIFTY')) {
      articles.push({
        id: `mock-nifty-1-${now}`,
        title: 'RBI leaves interest rates unchanged',
        description: 'The Reserve Bank of India has decided to keep repo rates unchanged, signaling a balanced approach to inflation.',
        url: 'https://example.com/rbi-rates',
        source: 'official government sources',
        publishedAt: now - 1000 * 60 * 15, // 15 mins ago
        fetchedAt: now,
        assets: ['NIFTY', 'BANKNIFTY'],
        category: 'Economy'
      });
    }

    return articles;
  }
}

let providerInstance: NewsProvider | null = null;

export function getNewsProvider(): NewsProvider {
  if (!providerInstance) {
    // We could switch based on env vars here
    // e.g. if (process.env.NEWS_API_KEY) providerInstance = new RealNewsProvider();
    providerInstance = new MockNewsProvider();
  }
  return providerInstance;
}
