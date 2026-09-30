import type {
  CandleData,
  SwingPoint,
  SwingType,
  MarketStructureEvent,
  StructureType,
  FairValueGap,
  TradingSignal,
  SignalGrade,
  Timeframe,
  TrendType,
  MarketTrendInfo,
  FibonacciLevel,
  AlgoCustomizationSettings,
} from '../types';

export const DEFAULT_ALGO_SETTINGS: AlgoCustomizationSettings = {
  lookbackBars: 5,
  fibonacciRatio: 0.618,
  fibonacciWeight: 18,
  structureWeight: 20,
  minDisplacementRatio: 1.25,
  minFvgPercent: 0.05,
  structureTypeFilter: 'ALL',
  minGradeFilter: 'ALL',
  engineMode: 'STRUCTURE_V7',
  stopAtrMultiplier: 1.5,
};

/**
 * 1:1 Implementation of ATR(n=14) with exponential smoothing (ewm alpha=1/n)
 * Exactly as in the backtest Python script:
 * tr = pd.concat([d['High'] - d['Low'], (d['High'] - pc).abs(), (d['Low'] - pc).abs()], axis=1).max(axis=1)
 * return tr.ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
 */
export function computeATR(candles: CandleData[], n = 14): number[] {
  const N = candles.length;
  if (N === 0) return [];

  const tr: number[] = [];
  for (let i = 0; i < N; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const pc = candles[i - 1].close;
      const hl = candles[i].high - candles[i].low;
      const hpc = Math.abs(candles[i].high - pc);
      const lpc = Math.abs(candles[i].low - pc);
      tr.push(Math.max(hl, hpc, lpc));
    }
  }

  const alpha = 1 / n;
  const atr: number[] = new Array(N);
  atr[0] = tr[0];
  for (let i = 1; i < N; i++) {
    atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1];
  }
  return atr;
}

/**
 * 1:1 Implementation of pivots(H, L, n) from Python script:
 * for i in range(2 * n, N):
 *     p = i - n
 *     if H[p] == H[p - n:i + 1].max() and (H[p - n:p] < H[p]).all(): ph[i] = H[p]
 *     if L[p] == L[p - n:i + 1].min() and (L[p - n:p] > L[p]).all(): pl[i] = L[p]
 */
export function computePivots(candles: CandleData[], n: number): {
  ph: Array<number | null>;
  pl: Array<number | null>;
} {
  const N = candles.length;
  const ph = new Array<number | null>(N).fill(null);
  const pl = new Array<number | null>(N).fill(null);

  const H = candles.map(c => c.high);
  const L = candles.map(c => c.low);

  for (let i = 2 * n; i < N; i++) {
    const p = i - n;

    // Check pivot high at p
    let isMax = true;
    let strictlyGreater = true;
    for (let k = p - n; k <= i; k++) {
      if (H[k] > H[p]) {
        isMax = false;
        break;
      }
    }
    for (let k = p - n; k < p; k++) {
      if (H[k] >= H[p]) {
        strictlyGreater = false;
        break;
      }
    }
    if (isMax && strictlyGreater) {
      ph[i] = H[p];
    }

    // Check pivot low at p
    let isMin = true;
    let strictlyLesser = true;
    for (let k = p - n; k <= i; k++) {
      if (L[k] < L[p]) {
        isMin = false;
        break;
      }
    }
    for (let k = p - n; k < p; k++) {
      if (L[k] <= L[p]) {
        strictlyLesser = false;
        break;
      }
    }
    if (isMin && strictlyLesser) {
      pl[i] = L[p];
    }
  }

  return { ph, pl };
}

export interface V7BarResult {
  trend: number; // 1 = Bullish, -1 = Bearish, 0 = None
  event: number; // 1 = MSS Naik, 2 = BOS Naik, -1 = MSS Turun, -2 = BOS Turun, 0 = None
  pL: number | null; // Protected Low
  pH: number | null; // Protected High
  q: boolean; // Quality Flag
  hh: number | null;
  ll: number | null;
  SH: number | null;
  SL: number | null;
  SHp: number | null;
  SLp: number | null;
  atr: number;
  buffer: number;
}

/**
 * 1:1 Implementation of Structure Engine v7 (HH-HL / LH-LL) from the user's Python script:
 * Return trend, event, protected low/high, quality-flag per bar (state setelah close bar i).
 */
export function runStructureEngineV7(
  candles: CandleData[],
  n = 5,
  buf = 0.25
): V7BarResult[] {
  const N = candles.length;
  if (N === 0) return [];

  const C = candles.map(c => c.close);
  const A = computeATR(candles, 14);
  const { ph, pl } = computePivots(candles, n);

  let SH: number | null = null;
  let SHp: number | null = null;
  let SL: number | null = null;
  let SLp: number | null = null;

  let trend = 0;
  let pL: number | null = null;
  let pH: number | null = null;
  let hh: number | null = null;
  let ll: number | null = null;
  let hh_b = true;
  let ll_b = true;
  let q = false;

  const results: V7BarResult[] = [];

  for (let i = 0; i < N; i++) {
    const nsh = ph[i] !== null;
    const nsl = pl[i] !== null;

    if (nsh) {
      SHp = SH;
      SH = ph[i];
    }
    if (nsl) {
      SLp = SL;
      SL = pl[i];
    }

    const b = buf * (A[i] || 0);
    let e = 0;

    if (!isNaN(b) && b > 0) {
      if (trend === 1) {
        if (nsl && SL !== null && (pL === null || SL > pL)) {
          pL = SL;
        }
        if (nsh && SH !== null && (hh === null || SH > hh)) {
          hh = SH;
          hh_b = false;
        }
        // MSS / CHoCH turun
        if (pL !== null && C[i] < pL - b) {
          trend = -1;
          e = -1;
          ll = pL;
          ll_b = true;
          pH = SH;
          q = false;
        }
        // BOS naik = HH baru
        else if (!hh_b && hh !== null && C[i] > hh + b) {
          e = 2;
          hh_b = true;
          q = SLp !== null && SL !== null && SL > SLp;
        }
      } else if (trend === -1) {
        if (nsh && SH !== null && (pH === null || SH < pH)) {
          pH = SH;
        }
        if (nsl && SL !== null && (ll === null || SL < ll)) {
          ll = SL;
          ll_b = false;
        }
        // MSS / CHoCH naik
        if (pH !== null && C[i] > pH + b) {
          trend = 1;
          e = 1;
          hh = pH;
          hh_b = true;
          pL = SL;
          q = false;
        }
        // BOS turun = LL baru
        else if (!ll_b && ll !== null && C[i] < ll - b) {
          e = -2;
          ll_b = true;
          q = SHp !== null && SH !== null && SH < SHp;
        }
      } else {
        // Initial detection
        if (SH !== null && SL !== null) {
          if (C[i] > SH + b) {
            trend = 1;
            e = 1;
            pL = SL;
            hh = SH;
            hh_b = true;
            q = SLp !== null && SL > SLp;
          } else if (C[i] < SL - b) {
            trend = -1;
            e = -1;
            pH = SH;
            ll = SL;
            ll_b = true;
            q = SHp !== null && SH < SHp;
          }
        }
      }
    }

    results.push({
      trend,
      event: e,
      pL,
      pH,
      q,
      hh,
      ll,
      SH,
      SL,
      SHp,
      SLp,
      atr: A[i] || 0,
      buffer: b,
    });
  }

  return results;
}

/**
 * 1:1 Implementation of VINNS.TRADE Original Engine from the Python script:
 * bu = C[i] > up + a[i] and C[i - 1] <= ups[i - 1] + a[i - 1]
 * bd = C[i] < lo - a[i] and C[i - 1] >= los[i - 1] - a[i - 1]
 */
export function runOriginalEngine(
  candles: CandleData[],
  lb = 5,
  fib = 0.618
): { trend: number[]; event: number[] } {
  const N = candles.length;
  if (N === 0) return { trend: [], event: [] };

  const C = candles.map(c => c.close);
  const A = computeATR(candles, 14);
  const { ph, pl } = computePivots(candles, lb);

  let up = NaN;
  let lo = NaN;
  let trend = 0;
  let lbr = NaN;
  let lbs = NaN;

  const ups: number[] = new Array(N).fill(NaN);
  const los: number[] = new Array(N).fill(NaN);
  const tr: number[] = new Array(N).fill(0);
  const ev: number[] = new Array(N).fill(0);

  for (let i = 0; i < N; i++) {
    if (ph[i] !== null) up = ph[i]!;
    if (pl[i] !== null) lo = pl[i]!;
    ups[i] = up;
    los[i] = lo;

    const a = (A[i] || 0) * fib;

    if (i > 0) {
      const bu = !isNaN(up) && C[i] > up + a && C[i - 1] <= ups[i - 1] + (A[i - 1] || 0) * fib;
      const bd = !isNaN(lo) && C[i] < lo - a && C[i - 1] >= los[i - 1] - (A[i - 1] || 0) * fib;

      if (bu) {
        if (trend <= 0) {
          trend = 1;
          lbr = up;
          ev[i] = 1;
        } else if (up !== lbr) {
          lbr = up;
          ev[i] = 2;
        }
      }
      if (bd) {
        if (trend >= 0) {
          trend = -1;
          lbs = lo;
          ev[i] = -1;
        } else if (lo !== lbs) {
          lbs = lo;
          ev[i] = -2;
        }
      }
    }
    tr[i] = trend;
  }

  return { trend: tr, event: ev };
}

/**
 * Calculate Fibonacci Retracement Levels based on active swing range
 */
export function calculateFibonacciLevels(
  highPrice: number,
  lowPrice: number,
  currentPrice: number,
  trend: TrendType
): { levels: FibonacciLevel[]; swingRange: { high: number; low: number }; closestFibo?: FibonacciLevel } {
  const range = Math.max(0.0001, highPrice - lowPrice);

  const ratios = [
    { ratio: 0.0, label: '0.0% Anchor', isKeyLevel: false },
    { ratio: 0.236, label: '23.6% Pullback', isKeyLevel: false },
    { ratio: 0.382, label: '38.2% Retracement', isKeyLevel: true },
    { ratio: 0.500, label: '50.0% Equilibrium', isKeyLevel: true },
    { ratio: 0.618, label: '61.8% Golden Ratio', isKeyLevel: true },
    { ratio: 0.650, label: '65.0% Golden Pocket', isKeyLevel: true },
    { ratio: 0.705, label: '70.5% OTE Zone', isKeyLevel: true },
    { ratio: 0.786, label: '78.6% Deep Discount', isKeyLevel: true },
    { ratio: 1.0, label: '100% Extreme', isKeyLevel: false },
  ];

  const levels: FibonacciLevel[] = ratios.map(r => {
    let price: number;
    if (trend === 'BEARISH') {
      price = lowPrice + range * r.ratio;
    } else {
      price = highPrice - range * r.ratio;
    }
    return {
      ratio: r.ratio,
      label: r.label,
      price: Number(price.toFixed(price > 100 ? 2 : 4)),
      isKeyLevel: r.isKeyLevel,
    };
  });

  let closestFibo = levels[0];
  let minDiff = Infinity;
  for (const lvl of levels) {
    const diff = Math.abs(lvl.price - currentPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closestFibo = lvl;
    }
  }

  return { levels, swingRange: { high: highPrice, low: lowPrice }, closestFibo };
}

/**
 * Detect Trend Status, Pivots & V7 State
 */
export function detectTrendStatus(
  candles: CandleData[],
  lookback = 5,
  bufFactor = 0.25
): MarketTrendInfo {
  if (candles.length < 15) {
    return {
      trend: 'SIDEWAYS',
      patternLabel: 'Sideways / Data Terbatas',
      lastHigh: null,
      lastLow: null,
      recentSwings: [],
      fibonacciLevels: [],
      zone: 'EQUILIBRIUM',
    };
  }

  const v7States = runStructureEngineV7(candles, lookback, bufFactor);
  const latestV7 = v7States[v7States.length - 1];
  const currentPrice = candles[candles.length - 1].close;

  // Find recent event
  let lastEventCode = 0;
  let lastEventIdx = -1;
  for (let i = v7States.length - 1; i >= 0; i--) {
    if (v7States[i].event !== 0) {
      lastEventCode = v7States[i].event;
      lastEventIdx = i;
      break;
    }
  }

  const eventNames: Record<number, string> = {
    1: 'MSS / CHoCH Naik (Pembalikan Tren Bullish)',
    2: 'BOS Naik (Konfirmasi Higher High / HH Baru)',
    [-1]: 'MSS / CHoCH Turun (Pembalikan Tren Bearish)',
    [-2]: 'BOS Turun (Konfirmasi Lower Low / LL Baru)',
    0: 'Konsolidasi Struktur (Holding Level)',
  };

  let trend: TrendType = 'SIDEWAYS';
  let patternLabel = 'Sedang Sideways / Konsolidasi (Holding Structure)';

  if (latestV7.trend === 1) {
    trend = 'BULLISH';
    patternLabel = 'Sedang Bullish (Higher High - Higher Low / HH-HL)';
  } else if (latestV7.trend === -1) {
    trend = 'BEARISH';
    patternLabel = 'Sedang Bearish (Lower Low - Lower High / LL-LH)';
  }

  const highPrice = latestV7.hh || latestV7.SH || currentPrice * 1.04;
  const lowPrice = latestV7.ll || latestV7.SL || currentPrice * 0.96;

  const { levels, swingRange, closestFibo } = calculateFibonacciLevels(
    highPrice,
    lowPrice,
    currentPrice,
    trend
  );

  const mid = (swingRange.high + swingRange.low) / 2;
  const zone: 'DISCOUNT' | 'PREMIUM' | 'EQUILIBRIUM' =
    Math.abs(currentPrice - mid) / mid < 0.005
      ? 'EQUILIBRIUM'
      : currentPrice < mid
      ? 'DISCOUNT'
      : 'PREMIUM';

  const lastHigh: SwingPoint | null = latestV7.SH
    ? {
        index: candles.length - 1,
        time: candles[candles.length - 1].time,
        price: latestV7.SH,
        type: latestV7.hh && latestV7.SH >= latestV7.hh ? 'HH' : 'LH',
      }
    : null;

  const lastLow: SwingPoint | null = latestV7.SL
    ? {
        index: candles.length - 1,
        time: candles[candles.length - 1].time,
        price: latestV7.SL,
        type: latestV7.ll && latestV7.SL <= latestV7.ll ? 'LL' : 'HL',
      }
    : null;

  return {
    trend,
    patternLabel,
    lastHigh,
    lastLow,
    recentSwings: [],
    fibonacciLevels: levels,
    closestFibo,
    zone,
    swingRange,
    v7State: {
      trendNumeric: latestV7.trend,
      lastEvent: lastEventCode,
      lastEventName: eventNames[lastEventCode] || 'Netral',
      protectedLow: latestV7.pL,
      protectedHigh: latestV7.pH,
      qualityFlag: latestV7.q,
      currentAtr: Number(latestV7.atr.toFixed(2)),
      atrBuffer: Number(latestV7.buffer.toFixed(2)),
      hh: latestV7.hh,
      ll: latestV7.ll,
      SH: latestV7.SH,
      SL: latestV7.SL,
    },
  };
}

/**
 * Generate Signals adhering strictly to VINNS.TRADE Structure Engine v7:
 * - Trade setup triggers on BOS / MSS events (or when holding trend structure above pL / below pH)
 * - Stop Loss = pL - stop_atr * ATR (for Buy) or pH + stop_atr * ATR (for Sell)
 * - Sizing & R:R based on distance to structural stop
 * - Quality Flag (q) = SL > SLp (Bullish) or SH < SHp (Bearish)
 */
export function generateInstitutionalSignals(
  symbol: string,
  timeframe: Timeframe,
  candles: CandleData[],
  customSettings?: Partial<AlgoCustomizationSettings>
): TradingSignal[] {
  if (candles.length < 20) return [];

  const settings: AlgoCustomizationSettings = {
    ...DEFAULT_ALGO_SETTINGS,
    ...(customSettings || {}),
  };

  const bufFactor = settings.fibonacciRatio || 0.25;
  const v7States = runStructureEngineV7(candles, settings.lookbackBars, bufFactor);
  const trendInfo = detectTrendStatus(candles, settings.lookbackBars, bufFactor);
  const latestV7 = v7States[v7States.length - 1];

  const signals: TradingSignal[] = [];
  const latestCandle = candles[candles.length - 1];
  const currentPrice = latestCandle.close;
  const stopAtrMultiplier = settings.stopAtrMultiplier || 1.5;
  const currentAtr = latestV7.atr || currentPrice * 0.015;

  // Selected Target Fibonacci Level
  const targetFibo =
    trendInfo.fibonacciLevels.find(f => Math.abs(f.ratio - settings.fibonacciRatio) < 0.005) ||
    trendInfo.fibonacciLevels.find(f => f.ratio === 0.618);

  const fiboPrice = targetFibo?.price || currentPrice;
  const fiboRatioLabel = targetFibo ? `${(targetFibo.ratio * 100).toFixed(1)}%` : '61.8%';

  // 1. Bullish Setup (Trend == 1)
  if (latestV7.trend === 1 && latestV7.pL !== null) {
    const isEventActive = latestV7.event === 2 || latestV7.event === 1;
    const pL = latestV7.pL;
    const stopLoss = Math.max(0.0001, pL - stopAtrMultiplier * currentAtr);
    const risk = Math.max(currentPrice * 0.005, currentPrice - stopLoss);
    const tp1 = currentPrice + risk * 2.0;
    const tp2 = currentPrice + risk * 3.5;
    const rr = risk > 0 ? (tp1 - currentPrice) / risk : 2.0;

    let score = 55;
    const confluenceFactors: string[] = [];

    // Structure Event Confluence
    if (latestV7.event === 1) {
      score += settings.structureWeight;
      confluenceFactors.push(`MSS / CHoCH Naik: Structural Reversal dari Bearish ke Bullish (+${settings.structureWeight}%)`);
    } else if (latestV7.event === 2) {
      score += settings.structureWeight;
      confluenceFactors.push(`BOS Naik: Break of Structure konfirmasi Higher High baru (+${settings.structureWeight}%)`);
    } else {
      score += Math.floor(settings.structureWeight * 0.75);
      confluenceFactors.push(`Bullish Orderflow: Harga stabil di atas Protected Low ($${pL.toLocaleString()})`);
    }

    // Quality Flag Confluence
    if (latestV7.q) {
      score += 15;
      confluenceFactors.push('Quality Flag (Q): Higher Low (SL > SLp) terkonfirmasi bersih tanpa fakeout');
    }

    // Protected Low
    confluenceFactors.push(`Protected Low (pL) support invalidation @ $${pL.toLocaleString()}`);

    // Fibonacci Retracement Confluence
    const fiboTolerance = fiboPrice * 0.02;
    const isAtFibo = Math.abs(currentPrice - fiboPrice) <= fiboTolerance;
    const fiboContribution = isAtFibo ? settings.fibonacciWeight : Math.floor(settings.fibonacciWeight * 0.7);
    score += fiboContribution;

    confluenceFactors.push(
      isAtFibo
        ? `Presisi Fibonacci Ratio ${fiboRatioLabel} Reversal Zone @ $${fiboPrice.toLocaleString()} (+${fiboContribution}%)`
        : `Fibonacci Level Support ${fiboRatioLabel} @ $${fiboPrice.toLocaleString()}`
    );

    // ATR Buffer
    confluenceFactors.push(`ATR(14) Volatility Buffer: $${(bufFactor * currentAtr).toFixed(2)}`);

    score = Math.min(score, 98);
    const grade: SignalGrade = score >= 85 ? 'S' : score >= 70 ? 'A' : 'B';

    const passesGrade =
      settings.minGradeFilter === 'ALL' ||
      (settings.minGradeFilter === 'A_PLUS' && (grade === 'S' || grade === 'A')) ||
      (settings.minGradeFilter === 'S_ONLY' && grade === 'S');

    const passesType =
      settings.structureTypeFilter === 'ALL' ||
      (settings.structureTypeFilter === 'CHOCH_ONLY' && latestV7.event === 1) ||
      (settings.structureTypeFilter === 'BOS_ONLY' && latestV7.event === 2);

    if (passesGrade && passesType) {
      signals.push({
        id: `SIG-BULL-V7-${symbol}-${latestCandle.time}`,
        timestamp: latestCandle.time * 1000,
        symbol,
        timeframe,
        direction: 'BUY',
        setupType:
          latestV7.event === 1
            ? 'MSS / CHoCH Reversal Naik (Engine v7)'
            : latestV7.event === 2
            ? 'BOS Naik: HH Expansion (Engine v7)'
            : 'Bullish Continuation di atas Protected Low',
        confidenceScore: score,
        strengthGrade: grade,
        confluenceFactors,
        entry: Number(currentPrice.toFixed(currentPrice > 100 ? 2 : 4)),
        stopLoss: Number(stopLoss.toFixed(stopLoss > 100 ? 2 : 4)),
        tp1: Number(tp1.toFixed(tp1 > 100 ? 2 : 4)),
        tp2: Number(tp2.toFixed(tp2 > 100 ? 2 : 4)),
        rrRatio: Number(rr.toFixed(1)),
        marketStructure: latestV7.event === 1 ? 'CHOCH_BULL' : 'BOS_BULL',
        v7Event: {
          code: latestV7.event || 2,
          name: latestV7.event === 1 ? 'MSS Naik' : 'BOS Naik (HH Baru)',
          protectedLevel: pL,
          qualityFlag: latestV7.q,
          atr: currentAtr,
        },
        fibonacciConfluence: {
          ratio: targetFibo?.ratio || 0.618,
          price: fiboPrice,
          description: `Retracement level ${fiboRatioLabel}`,
          scoreContribution: fiboContribution,
        },
        trendStatus: {
          trend: 'BULLISH',
          label: trendInfo.patternLabel,
        },
      });
    }
  }

  // 2. Bearish Setup (Trend == -1)
  if (latestV7.trend === -1 && latestV7.pH !== null) {
    const pH = latestV7.pH;
    const stopLoss = pH + stopAtrMultiplier * currentAtr;
    const risk = Math.max(currentPrice * 0.005, stopLoss - currentPrice);
    const tp1 = currentPrice - risk * 2.0;
    const tp2 = currentPrice - risk * 3.5;
    const rr = risk > 0 ? (currentPrice - tp1) / risk : 2.0;

    let score = 55;
    const confluenceFactors: string[] = [];

    if (latestV7.event === -1) {
      score += settings.structureWeight;
      confluenceFactors.push(`MSS / CHoCH Turun: Structural Reversal dari Bullish ke Bearish (+${settings.structureWeight}%)`);
    } else if (latestV7.event === -2) {
      score += settings.structureWeight;
      confluenceFactors.push(`BOS Turun: Break of Structure konfirmasi Lower Low baru (+${settings.structureWeight}%)`);
    } else {
      score += Math.floor(settings.structureWeight * 0.75);
      confluenceFactors.push(`Bearish Orderflow: Harga tertekan di bawah Protected High ($${pH.toLocaleString()})`);
    }

    if (latestV7.q) {
      score += 15;
      confluenceFactors.push('Quality Flag (Q): Lower High (SH < SHp) terkonfirmasi valid');
    }

    confluenceFactors.push(`Protected High (pH) resistance ceiling @ $${pH.toLocaleString()}`);

    const fiboTolerance = fiboPrice * 0.02;
    const isAtFibo = Math.abs(currentPrice - fiboPrice) <= fiboTolerance;
    const fiboContribution = isAtFibo ? settings.fibonacciWeight : Math.floor(settings.fibonacciWeight * 0.7);
    score += fiboContribution;

    confluenceFactors.push(
      isAtFibo
        ? `Presisi Fibonacci Ratio ${fiboRatioLabel} Resistance Zone @ $${fiboPrice.toLocaleString()} (+${fiboContribution}%)`
        : `Fibonacci Level Resistance ${fiboRatioLabel} @ $${fiboPrice.toLocaleString()}`
    );

    confluenceFactors.push(`ATR(14) Volatility Buffer: $${(bufFactor * currentAtr).toFixed(2)}`);

    score = Math.min(score, 97);
    const grade: SignalGrade = score >= 85 ? 'S' : score >= 70 ? 'A' : 'B';

    const passesGrade =
      settings.minGradeFilter === 'ALL' ||
      (settings.minGradeFilter === 'A_PLUS' && (grade === 'S' || grade === 'A')) ||
      (settings.minGradeFilter === 'S_ONLY' && grade === 'S');

    const passesType =
      settings.structureTypeFilter === 'ALL' ||
      (settings.structureTypeFilter === 'CHOCH_ONLY' && latestV7.event === -1) ||
      (settings.structureTypeFilter === 'BOS_ONLY' && latestV7.event === -2);

    if (passesGrade && passesType) {
      signals.push({
        id: `SIG-BEAR-V7-${symbol}-${latestCandle.time}`,
        timestamp: latestCandle.time * 1000,
        symbol,
        timeframe,
        direction: 'SELL',
        setupType:
          latestV7.event === -1
            ? 'MSS / CHoCH Reversal Turun (Engine v7)'
            : latestV7.event === -2
            ? 'BOS Turun: LL Expansion (Engine v7)'
            : 'Bearish Continuation di bawah Protected High',
        confidenceScore: score,
        strengthGrade: grade,
        confluenceFactors,
        entry: Number(currentPrice.toFixed(currentPrice > 100 ? 2 : 4)),
        stopLoss: Number(stopLoss.toFixed(stopLoss > 100 ? 2 : 4)),
        tp1: Number(tp1.toFixed(tp1 > 100 ? 2 : 4)),
        tp2: Number(tp2.toFixed(tp2 > 100 ? 2 : 4)),
        rrRatio: Number(rr.toFixed(1)),
        marketStructure: latestV7.event === -1 ? 'CHOCH_BEAR' : 'BOS_BEAR',
        v7Event: {
          code: latestV7.event || -2,
          name: latestV7.event === -1 ? 'MSS Turun' : 'BOS Turun (LL Baru)',
          protectedLevel: pH,
          qualityFlag: latestV7.q,
          atr: currentAtr,
        },
        fibonacciConfluence: {
          ratio: targetFibo?.ratio || 0.618,
          price: fiboPrice,
          description: `Retracement level ${fiboRatioLabel}`,
          scoreContribution: fiboContribution,
        },
        trendStatus: {
          trend: 'BEARISH',
          label: trendInfo.patternLabel,
        },
      });
    }
  }

  return signals;
}
