import type { CandleData, Timeframe, MarketTicker, AssetClass } from '../types';
import type { RealtimeMarketPayload } from './marketProxy';

export interface SymbolMetadata {
  symbol: string;
  name: string;
  category: AssetClass;
  basePrice: number;
  decimals: number;
  tradingViewSymbol: string;
  exchange: string;
  binanceSymbol?: string;
}

export const SUPPORTED_SYMBOLS: SymbolMetadata[] = [
  // Crypto (Live benchmarks)
  { symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', basePrice: 83080, decimals: 2, tradingViewSymbol: 'BINANCE:BTCUSDT', exchange: 'BINANCE', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', basePrice: 2664, decimals: 2, tradingViewSymbol: 'BINANCE:ETHUSDT', exchange: 'BINANCE', binanceSymbol: 'ETHUSDT' },
  { symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', basePrice: 154.5, decimals: 2, tradingViewSymbol: 'BINANCE:SOLUSDT', exchange: 'BINANCE', binanceSymbol: 'SOLUSDT' },
  { symbol: 'BNB/USDT', name: 'BNB Chain', category: 'CRYPTO', basePrice: 585.2, decimals: 2, tradingViewSymbol: 'BINANCE:BNBUSDT', exchange: 'BINANCE', binanceSymbol: 'BNBUSDT' },
  { symbol: 'XRP/USDT', name: 'Ripple', category: 'CRYPTO', basePrice: 0.584, decimals: 4, tradingViewSymbol: 'BINANCE:XRPUSDT', exchange: 'BINANCE', binanceSymbol: 'XRPUSDT' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', category: 'CRYPTO', basePrice: 0.125, decimals: 4, tradingViewSymbol: 'BINANCE:DOGEUSDT', exchange: 'BINANCE', binanceSymbol: 'DOGEUSDT' },
  { symbol: 'ADA/USDT', name: 'Cardano', category: 'CRYPTO', basePrice: 0.395, decimals: 4, tradingViewSymbol: 'BINANCE:ADAUSDT', exchange: 'BINANCE', binanceSymbol: 'ADAUSDT' },
  { symbol: 'AVAX/USDT', name: 'Avalanche', category: 'CRYPTO', basePrice: 28.4, decimals: 2, tradingViewSymbol: 'BINANCE:AVAXUSDT', exchange: 'BINANCE', binanceSymbol: 'AVAXUSDT' },
  { symbol: 'LINK/USDT', name: 'Chainlink', category: 'CRYPTO', basePrice: 12.15, decimals: 2, tradingViewSymbol: 'BINANCE:LINKUSDT', exchange: 'BINANCE', binanceSymbol: 'LINKUSDT' },
  { symbol: 'SUI/USDT', name: 'Sui Network', category: 'CRYPTO', basePrice: 1.82, decimals: 4, tradingViewSymbol: 'BINANCE:SUIUSDT', exchange: 'BINANCE', binanceSymbol: 'SUIUSDT' },

  // US Stocks
  { symbol: 'NVDA', name: 'NVIDIA Corp', category: 'STOCK', basePrice: 227.21, decimals: 2, tradingViewSymbol: 'NASDAQ:NVDA', exchange: 'NASDAQ' },
  { symbol: 'AAPL', name: 'Apple Inc', category: 'STOCK', basePrice: 228.4, decimals: 2, tradingViewSymbol: 'NASDAQ:AAPL', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corp', category: 'STOCK', basePrice: 432.1, decimals: 2, tradingViewSymbol: 'NASDAQ:MSFT', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc', category: 'STOCK', basePrice: 254.2, decimals: 2, tradingViewSymbol: 'NASDAQ:TSLA', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc', category: 'STOCK', basePrice: 187.9, decimals: 2, tradingViewSymbol: 'NASDAQ:AMZN', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc (Google)', category: 'STOCK', basePrice: 164.3, decimals: 2, tradingViewSymbol: 'NASDAQ:GOOGL', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms (Facebook)', category: 'STOCK', basePrice: 567.8, decimals: 2, tradingViewSymbol: 'NASDAQ:META', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'STOCK', basePrice: 156.4, decimals: 2, tradingViewSymbol: 'NASDAQ:AMD', exchange: 'NASDAQ' },
  { symbol: 'MSTR', name: 'MicroStrategy Inc', category: 'STOCK', basePrice: 172.5, decimals: 2, tradingViewSymbol: 'NASDAQ:MSTR', exchange: 'NASDAQ' },
  { symbol: 'PLTR', name: 'Palantir Technologies', category: 'STOCK', basePrice: 37.8, decimals: 2, tradingViewSymbol: 'NYSE:PLTR', exchange: 'NYSE' },

  // Forex
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'FOREX', basePrice: 1.1349, decimals: 4, tradingViewSymbol: 'FX:EURUSD', exchange: 'FX' },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'FOREX', basePrice: 1.3385, decimals: 4, tradingViewSymbol: 'FX:GBPUSD', exchange: 'FX' },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'FOREX', basePrice: 143.6, decimals: 2, tradingViewSymbol: 'FX:USDJPY', exchange: 'FX' },
  { symbol: 'AUD/USD', name: 'Australian Dollar / USD', category: 'FOREX', basePrice: 0.6912, decimals: 4, tradingViewSymbol: 'FX:AUDUSD', exchange: 'FX' },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'FOREX', basePrice: 1.3508, decimals: 4, tradingViewSymbol: 'FX:USDCAD', exchange: 'FX' },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'FOREX', basePrice: 0.8465, decimals: 4, tradingViewSymbol: 'FX:USDCHF', exchange: 'FX' },

  // Commodities
  { symbol: 'XAU/USD', name: 'Gold Spot / Emas Fisik', category: 'COMMODITY', basePrice: 4212.8, decimals: 2, tradingViewSymbol: 'OANDA:XAUUSD', exchange: 'OANDA' },
  { symbol: 'XAG/USD', name: 'Silver Spot / Perak', category: 'COMMODITY', basePrice: 31.85, decimals: 2, tradingViewSymbol: 'OANDA:XAGUSD', exchange: 'OANDA' },
  { symbol: 'WTI/USD', name: 'Crude Oil (WTI)', category: 'COMMODITY', basePrice: 71.2, decimals: 2, tradingViewSymbol: 'TVC:USOIL', exchange: 'TVC' },

  // Indices
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', category: 'INDEX', basePrice: 572.4, decimals: 2, tradingViewSymbol: 'AMEX:SPY', exchange: 'AMEX' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', category: 'INDEX', basePrice: 489.1, decimals: 2, tradingViewSymbol: 'NASDAQ:QQQ', exchange: 'NASDAQ' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average', category: 'INDEX', basePrice: 423.8, decimals: 2, tradingViewSymbol: 'AMEX:DIA', exchange: 'AMEX' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', category: 'INDEX', basePrice: 221.5, decimals: 2, tradingViewSymbol: 'AMEX:IWM', exchange: 'AMEX' },
];

export function findSymbolMetadata(symbol: string): SymbolMetadata {
  const clean = symbol.trim().toUpperCase();
  const directMatch = SUPPORTED_SYMBOLS.find(s => s.symbol.toUpperCase() === clean);
  if (directMatch) return directMatch;

  const cleanTicker = clean.replace('/', '');
  const partial = SUPPORTED_SYMBOLS.find(s => s.symbol.replace('/', '').toUpperCase() === cleanTicker);
  if (partial) return partial;

  return {
    symbol: clean,
    name: `${clean} Asset`,
    category: clean.includes('USDT') || clean.includes('BTC') ? 'CRYPTO' : clean.includes('/') ? 'FOREX' : 'STOCK',
    basePrice: 100.0,
    decimals: clean.includes('/') && !clean.includes('USDT') ? 4 : 2,
    tradingViewSymbol: clean.includes('/') ? `FX:${clean.replace('/', '')}` : `NASDAQ:${clean}`,
    exchange: 'GLOBAL',
  };
}

export function getTimeframeSeconds(tf: Timeframe): number {
  switch (tf) {
    case '1M': return 60;
    case '5M': return 300;
    case '15M': return 900;
    case '30M': return 1800;
    case '1H': return 3600;
    case '4H': return 14400;
    case '1D': return 86400;
    case '1W': return 604800;
    default: return 3600;
  }
}

export function getBinanceInterval(tf: Timeframe): string {
  switch (tf) {
    case '1M': return '1m';
    case '5M': return '5m';
    case '15M': return '15m';
    case '30M': return '30m';
    case '1H': return '1h';
    case '4H': return '4h';
    case '1D': return '1d';
    case '1W': return '1w';
    default: return '1h';
  }
}

export function getTradingViewInterval(tf: Timeframe): string {
  switch (tf) {
    case '1M': return '1';
    case '5M': return '5';
    case '15M': return '15';
    case '30M': return '30';
    case '1H': return '60';
    case '4H': return '240';
    case '1D': return 'D';
    case '1W': return 'W';
    default: return '60';
  }
}

/**
 * Client-side direct Binance fallback for Crypto
 */
export async function fetchLiveBinanceCandles(
  binanceSymbol: string,
  timeframe: Timeframe,
  limit = 100
): Promise<CandleData[] | null> {
  try {
    const interval = getBinanceInterval(timeframe);
    const cleanSym = binanceSymbol.replace('/', '').toUpperCase();
    const url = `https://api.binance.com/api/v3/klines?symbol=${cleanSym}&interval=${interval}&limit=${limit}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;

    return raw.map((k: any[]) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (err) {
    return null;
  }
}

/**
 * Generate synthetic realistic market candles with SMC patterns & Fibonacci swings
 */
export function generateSyntheticCandles(
  symbol: string,
  timeframe: Timeframe,
  count = 120,
  anchorPrice?: number
): CandleData[] {
  const meta = findSymbolMetadata(symbol);
  const tfSeconds = getTimeframeSeconds(timeframe);
  const nowSec = Math.floor(Date.now() / 1000);
  const startTime = nowSec - count * tfSeconds;

  const candles: CandleData[] = [];
  const base = anchorPrice && anchorPrice > 0 ? anchorPrice : meta.basePrice;
  let price = base * 0.97;

  const volFactor =
    meta.category === 'CRYPTO'
      ? 0.007
      : meta.category === 'STOCK'
      ? 0.0035
      : meta.category === 'COMMODITY'
      ? 0.0025
      : 0.0012;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * tfSeconds;

    const cycle = Math.sin(i / 11) * 0.75 + Math.sin(i / 4.5) * 0.35;
    const isDisplacement = i % 16 === 0 || i % 16 === 8;
    const impulse = isDisplacement ? (i % 32 === 0 ? 2.1 : -1.8) : 0;

    const drift = (cycle * 0.55 + impulse * 0.8) * volFactor;
    const randomNoise = (Math.random() - 0.49) * volFactor;
    const change = price * (drift + randomNoise);

    const open = price;
    const close = Math.max(open * 0.4, open + change);
    const highWick = Math.random() * Math.abs(change) * 0.75 + price * volFactor * 0.25;
    const lowWick = Math.random() * Math.abs(change) * 0.75 + price * volFactor * 0.25;

    const high = Math.max(open, close) + highWick;
    const low = Math.min(open, close) - lowWick;

    const volume = Math.floor(
      (1200 + Math.random() * 3200) *
      (isDisplacement ? 2.9 : 1.0) *
      (meta.category === 'CRYPTO' ? 18 : 65)
    );

    candles.push({
      time,
      open: Number(open.toFixed(meta.decimals)),
      high: Number(high.toFixed(meta.decimals)),
      low: Number(low.toFixed(meta.decimals)),
      close: Number(close.toFixed(meta.decimals)),
      volume,
    });

    price = close;
  }

  return candles;
}

/**
 * Primary Real-Time Market Data Provider:
 * 1. Fetches real-time candles from server proxy (/api/market/candles)
 * 2. If client-side crypto, falls back to direct Binance API
 * 3. Falls back to high-fidelity synthetic data anchored to real base price
 */
export async function getRealtimeCandles(
  symbol: string,
  timeframe: Timeframe,
  count = 120
): Promise<{
  candles: CandleData[];
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  source: string;
  exchange: string;
  isLiveStream: boolean;
}> {
  const meta = findSymbolMetadata(symbol);

  // 1. Try server proxy endpoint (fetches Binance or Yahoo Finance)
  try {
    const url = `/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (res.ok) {
      const data: RealtimeMarketPayload = await res.json();
      if (data && Array.isArray(data.candles) && data.candles.length > 10) {
        return {
          candles: data.candles.slice(-count),
          price: data.price,
          change24h: data.change24h,
          high24h: data.high24h,
          low24h: data.low24h,
          volume24h: data.volume24h,
          source: data.source,
          exchange: data.exchange,
          isLiveStream: true,
        };
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // 2. Direct client-side Binance fallback for crypto
  if (meta.binanceSymbol) {
    const live = await fetchLiveBinanceCandles(meta.binanceSymbol, timeframe, count);
    if (live && live.length > 20) {
      const lastPrice = live[live.length - 1].close;
      const firstPrice = live[0].open;
      const change24h = Number((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(2));
      return {
        candles: live,
        price: lastPrice,
        change24h,
        high24h: Math.max(...live.map(c => c.high)),
        low24h: Math.min(...live.map(c => c.low)),
        volume24h: '$450.2M',
        source: 'BINANCE_CLIENT_LIVE',
        exchange: 'BINANCE',
        isLiveStream: true,
      };
    }
  }

  // 3. Fallback: High-fidelity synthetic anchored to real benchmark base price
  const synthetic = generateSyntheticCandles(symbol, timeframe, count, meta.basePrice);
  const lastPrice = synthetic[synthetic.length - 1].close;
  const firstPrice = synthetic[0].open;
  const change24h = Number((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(2));

  return {
    candles: synthetic,
    price: lastPrice,
    change24h,
    high24h: Math.max(...synthetic.map(c => c.high)),
    low24h: Math.min(...synthetic.map(c => c.low)),
    volume24h: '$280.5M',
    source: 'BENCHMARK_SYNTHETIC',
    exchange: meta.exchange,
    isLiveStream: false,
  };
}

/**
 * Fast real-time quote fetcher
 */
export async function getRealtimeQuote(symbol: string): Promise<{
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  source: string;
  exchange: string;
}> {
  const meta = findSymbolMetadata(symbol);
  try {
    const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const q = await res.json();
      if (q && q.price) {
        return q;
      }
    }
  } catch (err) {
    // fallback
  }

  return {
    price: meta.basePrice,
    change24h: 1.25,
    high24h: meta.basePrice * 1.02,
    low24h: meta.basePrice * 0.98,
    volume24h: '$320.0M',
    source: 'BENCHMARK',
    exchange: meta.exchange,
  };
}

/**
 * Generate initial ticker watchlist
 */
export function generateInitialTickers(): MarketTicker[] {
  return SUPPORTED_SYMBOLS.map(s => {
    const change = Number((Math.random() * 4.5 - 1.8).toFixed(2));
    const price = Number((s.basePrice * (1 + change / 100)).toFixed(s.decimals));
    const range = price * 0.03;
    return {
      symbol: s.symbol,
      name: s.name,
      price,
      change24h: change,
      high24h: Number((price + range * 0.6).toFixed(s.decimals)),
      low24h: Number((price - range * 0.4).toFixed(s.decimals)),
      volume24h: `$${(Math.random() * 450 + 120).toFixed(1)}M`,
      category: s.category,
    };
  });
}
