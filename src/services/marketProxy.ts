import type { CandleData, Timeframe, AssetClass } from '../types';

export interface RealtimeMarketPayload {
  symbol: string;
  name: string;
  category: AssetClass;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  exchange: string;
  candles: CandleData[];
  source: 'BINANCE_LIVE' | 'YAHOO_LIVE' | 'FALLBACK_SYNTHETIC';
  timestamp: number;
}

export function mapToYahooSymbol(symbol: string): { ticker: string; name: string; category: AssetClass; exchange: string } {
  const s = symbol.trim().toUpperCase();
  if (s === 'GOLD' || s === 'XAU/USD' || s === 'XAUUSD') {
    return { ticker: 'GC=F', name: 'Gold Spot / Emas Fisik', category: 'COMMODITY', exchange: 'COMEX' };
  }
  if (s === 'SILVER' || s === 'XAG/USD' || s === 'XAGUSD') {
    return { ticker: 'SI=F', name: 'Silver Spot / Perak', category: 'COMMODITY', exchange: 'COMEX' };
  }
  if (s === 'WTI/USD' || s === 'OIL' || s === 'CL=F') {
    return { ticker: 'CL=F', name: 'Crude Oil (WTI)', category: 'COMMODITY', exchange: 'NYMEX' };
  }
  if (s === 'EUR/USD' || s === 'EURUSD') {
    return { ticker: 'EURUSD=X', name: 'Euro / US Dollar', category: 'FOREX', exchange: 'FX' };
  }
  if (s === 'GBP/USD' || s === 'GBPUSD') {
    return { ticker: 'GBPUSD=X', name: 'British Pound / USD', category: 'FOREX', exchange: 'FX' };
  }
  if (s === 'USD/JPY' || s === 'USDJPY') {
    return { ticker: 'JPY=X', name: 'USD / Japanese Yen', category: 'FOREX', exchange: 'FX' };
  }
  if (s === 'AUD/USD' || s === 'AUDUSD') {
    return { ticker: 'AUDUSD=X', name: 'Australian Dollar / USD', category: 'FOREX', exchange: 'FX' };
  }
  if (s === 'USD/CAD' || s === 'USDCAD') {
    return { ticker: 'CAD=X', name: 'USD / Canadian Dollar', category: 'FOREX', exchange: 'FX' };
  }
  if (s === 'USD/CHF' || s === 'USDCHF') {
    return { ticker: 'CHF=X', name: 'USD / Swiss Franc', category: 'FOREX', exchange: 'FX' };
  }
  if (s === 'SPY') return { ticker: 'SPY', name: 'SPDR S&P 500 ETF', category: 'INDEX', exchange: 'AMEX' };
  if (s === 'QQQ') return { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', category: 'INDEX', exchange: 'NASDAQ' };
  if (s === 'DIA') return { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average', category: 'INDEX', exchange: 'AMEX' };
  if (s === 'IWM') return { ticker: 'IWM', name: 'iShares Russell 2000 ETF', category: 'INDEX', exchange: 'AMEX' };

  // Common US Stocks
  const stockNames: Record<string, string> = {
    NVDA: 'NVIDIA Corporation',
    AAPL: 'Apple Inc',
    MSFT: 'Microsoft Corporation',
    TSLA: 'Tesla Inc',
    AMZN: 'Amazon.com Inc',
    GOOGL: 'Alphabet Inc (Google)',
    META: 'Meta Platforms Inc',
    AMD: 'Advanced Micro Devices',
    MSTR: 'MicroStrategy Inc',
    PLTR: 'Palantir Technologies',
  };

  const clean = s.replace('/', '').toUpperCase();
  return {
    ticker: clean,
    name: stockNames[clean] || `${clean} Equity`,
    category: 'STOCK',
    exchange: 'NASDAQ',
  };
}

export function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  return (
    s.includes('USDT') ||
    s.includes('BTC') ||
    s.includes('ETH') ||
    s.includes('SOL') ||
    s.includes('BNB') ||
    s.includes('XRP') ||
    s.includes('DOGE') ||
    s.includes('ADA') ||
    s.includes('AVAX') ||
    s.includes('LINK') ||
    s.includes('SUI')
  );
}

export async function fetchLiveBinanceMarketData(
  symbol: string,
  timeframe: Timeframe = '1H'
): Promise<RealtimeMarketPayload | null> {
  try {
    let cleanSym = symbol.replace('/', '').toUpperCase();
    if (!cleanSym.endsWith('USDT') && !cleanSym.endsWith('BTC')) {
      cleanSym += 'USDT';
    }

    const intervalMap: Record<string, string> = {
      '1M': '1m',
      '5M': '5m',
      '15M': '15m',
      '30M': '30m',
      '1H': '1h',
      '4H': '4h',
      '1D': '1d',
      '1W': '1w',
    };
    const interval = intervalMap[timeframe] || '1h';

    // 1. Fetch 24hr ticker
    const tickerUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${cleanSym}`;
    const tickerRes = await fetch(tickerUrl, { signal: AbortSignal.timeout(3500) });
    if (!tickerRes.ok) return null;
    const tickerJson: any = await tickerRes.json();

    // 2. Fetch Klines
    const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=${cleanSym}&interval=${interval}&limit=120`;
    const klinesRes = await fetch(klinesUrl, { signal: AbortSignal.timeout(3500) });
    if (!klinesRes.ok) return null;
    const klinesJson: any = await klinesRes.json();
    if (!Array.isArray(klinesJson) || klinesJson.length === 0) return null;

    const candles: CandleData[] = klinesJson.map((k: any[]) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    const currentPrice = parseFloat(tickerJson.lastPrice);
    const change24h = parseFloat(tickerJson.priceChangePercent);
    const high24h = parseFloat(tickerJson.highPrice);
    const low24h = parseFloat(tickerJson.lowPrice);
    const quoteVolume = parseFloat(tickerJson.quoteVolume);
    const volumeFormatted =
      quoteVolume > 1_000_000_000
        ? `$${(quoteVolume / 1_000_000_000).toFixed(2)}B`
        : `$${(quoteVolume / 1_000_000).toFixed(1)}M`;

    return {
      symbol: symbol.includes('/') ? symbol : `${cleanSym.replace('USDT', '')}/USDT`,
      name: cleanSym.replace('USDT', ''),
      category: 'CRYPTO',
      price: currentPrice,
      change24h,
      high24h,
      low24h,
      volume24h: volumeFormatted,
      exchange: 'BINANCE',
      candles,
      source: 'BINANCE_LIVE',
      timestamp: Date.now(),
    };
  } catch (err) {
    return null;
  }
}

export async function fetchLiveYahooMarketData(
  symbol: string,
  timeframe: Timeframe = '1H'
): Promise<RealtimeMarketPayload | null> {
  try {
    const { ticker, name, category, exchange } = mapToYahooSymbol(symbol);

    const tfConfig: Record<string, { interval: string; range: string }> = {
      '1M': { interval: '1m', range: '1d' },
      '5M': { interval: '5m', range: '1d' },
      '15M': { interval: '15m', range: '5d' },
      '30M': { interval: '30m', range: '5d' },
      '1H': { interval: '1h', range: '1mo' },
      '4H': { interval: '1h', range: '3mo' },
      '1D': { interval: '1d', range: '1y' },
      '1W': { interval: '1wk', range: '2y' },
    };

    const cfg = tfConfig[timeframe] || { interval: '1h', range: '1mo' };
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${cfg.interval}&range=${cfg.range}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const candles: CandleData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      if (c != null && o != null && h != null && l != null) {
        candles.push({
          time: timestamps[i],
          open: Number(o.toFixed(meta.priceHint || 2)),
          high: Number(h.toFixed(meta.priceHint || 2)),
          low: Number(l.toFixed(meta.priceHint || 2)),
          close: Number(c.toFixed(meta.priceHint || 2)),
          volume: volumes[i] || 1000,
        });
      }
    }

    if (candles.length < 5) return null;

    const currentPrice = meta.regularMarketPrice || candles[candles.length - 1].close;
    const prevClose = meta.chartPreviousClose || candles[0].open;
    const change24h = prevClose > 0 ? Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;
    const high24h = meta.regularMarketDayHigh || Math.max(...candles.slice(-24).map(c => c.high));
    const low24h = meta.regularMarketDayLow || Math.min(...candles.slice(-24).map(c => c.low));
    const rawVol = meta.regularMarketVolume || 1500000;
    const volumeFormatted =
      rawVol > 1_000_000_000
        ? `$${(rawVol / 1_000_000_000).toFixed(2)}B`
        : `$${(rawVol / 1_000_000).toFixed(1)}M`;

    return {
      symbol: symbol.toUpperCase(),
      name,
      category,
      price: Number(currentPrice.toFixed(category === 'FOREX' ? 4 : 2)),
      change24h,
      high24h: Number(high24h.toFixed(category === 'FOREX' ? 4 : 2)),
      low24h: Number(low24h.toFixed(category === 'FOREX' ? 4 : 2)),
      volume24h: volumeFormatted,
      exchange,
      candles: candles.slice(-120),
      source: 'YAHOO_LIVE',
      timestamp: Date.now(),
    };
  } catch (err) {
    return null;
  }
}

export async function fetchLiveMarketData(
  symbol: string,
  timeframe: Timeframe = '1H'
): Promise<RealtimeMarketPayload | null> {
  if (isCryptoSymbol(symbol)) {
    const cryptoData = await fetchLiveBinanceMarketData(symbol, timeframe);
    if (cryptoData) return cryptoData;
  }

  // Stock, Forex, Commodity, Index or fallback
  const yahooData = await fetchLiveYahooMarketData(symbol, timeframe);
  if (yahooData) return yahooData;

  // Secondary retry for crypto via Yahoo (e.g. BTC-USD)
  if (isCryptoSymbol(symbol)) {
    const cleanSym = symbol.replace('/', '-').replace('USDT', 'USD');
    const cryptoYahoo = await fetchLiveYahooMarketData(cleanSym, timeframe);
    if (cryptoYahoo) {
      cryptoYahoo.symbol = symbol;
      cryptoYahoo.category = 'CRYPTO';
      return cryptoYahoo;
    }
  }

  return null;
}
