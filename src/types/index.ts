export type TradeType = 'BUY' | 'SELL';
export type TradeStatus = 'Realized' | 'Floating';
export type AssetClass = 'CRYPTO' | 'STOCK' | 'FOREX' | 'COMMODITY' | 'INDEX';

export interface InvestmentRecord {
  id: string; // e.g. ROW-2
  rowNumber?: number; // Sheet row index (2, 3, etc.)
  type: TradeType; // Column A: Type (BUY, SELL)
  asset: string; // Column B: Asset (GOLD, MSFT, SPCX, WDC, NVDA, QCOM, QQQ, MSTR)
  nominalIdr: number; // Column C: Nominal (IDR)
  kursIdrUsd: number; // Column D: Kurs IDR-USD (e.g. 17890)
  jumlah: number; // Column E: Jumlah / Qty (e.g. 1.300)
  entryDate: string; // Column F: Entry Date (e.g. 2026-07-22)
  exitDate?: string; // Column G: Exit Date (e.g. 2026-07-30 or empty)
  entryPrice: number; // Column H: Entry Price in USD (or IDR for Gold)
  exitPrice?: number; // Column I: Exit Price in USD (or IDR for Gold)
  pnlPercent: number; // Column J: PnL % (e.g. 9.39%)
  spreadCost: number; // Column K: SPREAD 0.5% in IDR (e.g. -24152)
  labaBersih: number; // Column L: Laba Bersih in IDR (e.g. 431425)
  status: TradeStatus; // Column M: Notes (Realized / Floating)
  nilaiAset: number; // Column N: Nilai Aset in IDR
}

export interface AssetSummary {
  asset: string;
  averageBuy: number;
  priceNow: number;
  pnlPercent: number;
  valueTotalIdr: number;
}

export type Timeframe = '1M' | '5M' | '15M' | '30M' | '1H' | '4H' | '1D' | '1W';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SwingType = 'HH' | 'HL' | 'LH' | 'LL';

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: SwingType;
}

export type StructureType = 'BOS_BULL' | 'BOS_BEAR' | 'CHOCH_BULL' | 'CHOCH_BEAR' | 'RANGE';

export interface MarketStructureEvent {
  type: StructureType;
  price: number;
  time: number;
  confirmedAtTime: number;
  brokenLevel: number;
  description: string;
}

export interface FairValueGap {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  topPrice: number;
  bottomPrice: number;
  startIndex: number;
  startTime: number;
  mitigated: boolean;
  mitigatedAtTime?: number;
}

export type SignalGrade = 'S' | 'A' | 'B';

export type TrendType = 'BULLISH' | 'BEARISH' | 'SIDEWAYS';

export interface FibonacciLevel {
  ratio: number; // 0, 0.236, 0.382, 0.5, 0.618, 0.65, 0.705, 0.786, 1
  label: string; // e.g. "61.8% Golden Ratio", "50% Equilibrium"
  price: number;
  isKeyLevel?: boolean;
}

export interface MarketTrendInfo {
  trend: TrendType;
  patternLabel: string; // e.g. "Bullish (Higher High - Higher Low / HH-HL)"
  lastHigh: SwingPoint | null;
  lastLow: SwingPoint | null;
  recentSwings: SwingPoint[];
  fibonacciLevels: FibonacciLevel[];
  closestFibo?: FibonacciLevel;
  zone: 'DISCOUNT' | 'PREMIUM' | 'EQUILIBRIUM';
  swingRange?: { high: number; low: number };
  v7State?: {
    trendNumeric: number; // 1 = Bullish, -1 = Bearish, 0 = Neutral
    lastEvent: number; // 1 = MSS Naik, 2 = BOS Naik, -1 = MSS Turun, -2 = BOS Turun, 0 = None
    lastEventName: string;
    protectedLow: number | null;
    protectedHigh: number | null;
    qualityFlag: boolean; // q = SL > SLp (Bullish) or SH < SHp (Bearish)
    currentAtr: number;
    atrBuffer: number;
    hh: number | null;
    ll: number | null;
    SH: number | null;
    SL: number | null;
  };
}

export interface AlgoCustomizationSettings {
  lookbackBars: number; // 2, 3, 5, 8
  fibonacciRatio: number; // 0.618, 0.50, 0.705, 0.786, 0.382
  fibonacciWeight: number; // 10 - 30%
  structureWeight: number; // 10 - 30%
  minDisplacementRatio: number; // 1.1 - 2.0x
  minFvgPercent: number; // 0.02 - 0.15%
  structureTypeFilter: 'ALL' | 'CHOCH_ONLY' | 'BOS_ONLY';
  minGradeFilter: 'ALL' | 'A_PLUS' | 'S_ONLY';
  engineMode?: 'STRUCTURE_V7' | 'VINNS_ORIGINAL';
  stopAtrMultiplier?: number; // default 1.5
}

export interface TradingSignal {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: Timeframe;
  direction: 'BUY' | 'SELL';
  setupType: string;
  confidenceScore: number; // 0 - 100
  strengthGrade: SignalGrade;
  confluenceFactors: string[];
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  rrRatio: number;
  marketStructure: string;
  fvgZone?: { top: number; bottom: number };
  v7Event?: {
    code: number;
    name: string;
    protectedLevel: number;
    qualityFlag: boolean;
    atr: number;
  };
  fibonacciConfluence?: {
    ratio: number;
    price: number;
    description: string;
    scoreContribution: number;
  };
  trendStatus?: {
    trend: TrendType;
    label: string;
  };
}

export interface SignalNotebookItem {
  id: string;
  savedAt: number;
  signal: TradingSignal;
  trendPattern: string;
  userNotes?: string;
  targetStrategy?: string;
}

export interface AISentimentResponse {
  sentimentScore: number;
  label: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confidence: number;
  hedgeFundSummary: string;
  confluenceAnalysis: string;
  macroFactors: string[];
  riskAlerts: string[];
  recommendedAction: 'EXECUTE' | 'WAIT_PULLBACK' | 'AVOID' | 'TAKE_PROFIT';
  modelUsed: string;
  fallbackHistory?: string[];
}

export type DateFilterPreset = 'ALL' | '1D' | '7D' | '30D' | '90D' | 'YTD' | '1Y' | 'CUSTOM';

export interface DateFilter {
  preset: DateFilterPreset;
  startDate?: string;
  endDate?: string;
}

export type ActivePage = 'portfolio' | 'settings';

export interface MarketTicker {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  category: AssetClass;
}
