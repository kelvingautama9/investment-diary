import React, { useState, useMemo } from 'react';
import {
  X,
  Calculator,
  ShieldAlert,
  TrendingUp,
  Target,
  ArrowRight,
  Copy,
  Check,
  Percent,
  Coins,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';

interface RiskCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCapital?: number;
  onApplyPlan?: (plan: {
    asset: string;
    entryPrice: number;
    nominalIdr: number;
    jumlah: number;
    kursIdrUsd: number;
    notes: string;
  }) => void;
}

export const RiskCalculatorModal: React.FC<RiskCalculatorModalProps> = ({
  isOpen,
  onClose,
  defaultCapital = 50000000,
  onApplyPlan,
}) => {
  const { formatPrivacyIdr } = usePrivacy();

  const [totalCapital, setTotalCapital] = useState<number>(defaultCapital > 0 ? defaultCapital : 50000000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [assetSymbol, setAssetSymbol] = useState<string>('NVDA');
  const [currency, setCurrency] = useState<'USD' | 'IDR'>('USD');
  const [kursIdrUsd, setKursIdrUsd] = useState<number>(17890);
  const [entryPrice, setEntryPrice] = useState<number>(130);
  const [stopLossPrice, setStopLossPrice] = useState<number>(123.5);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(146.25);
  const [copied, setCopied] = useState(false);

  // Sync defaultCapital if provided
  React.useEffect(() => {
    if (defaultCapital > 0 && isOpen) {
      setTotalCapital(defaultCapital);
    }
  }, [defaultCapital, isOpen]);

  // Real-time calculations
  const calc = useMemo(() => {
    const riskAmountIdr = (totalCapital * (riskPercent / 100));
    const effectiveEntry = Number(entryPrice) || 0;
    const effectiveSL = Number(stopLossPrice) || 0;
    const effectiveTP = Number(takeProfitPrice) || 0;

    if (effectiveEntry <= 0 || effectiveSL <= 0) {
      return {
        isValid: false,
        riskAmountIdr,
        slDistancePrice: 0,
        slDistancePercent: 0,
        tpDistancePrice: 0,
        tpDistancePercent: 0,
        rrRatio: 0,
        recommendedUnits: 0,
        recommendedLots: 0,
        allocatedCapitalIdr: 0,
        potentialProfitIdr: 0,
        error: 'Entry Price dan Stop Loss harus lebih dari 0',
      };
    }

    const slDistancePrice = Math.abs(effectiveEntry - effectiveSL);
    const slDistancePercent = (slDistancePrice / effectiveEntry) * 100;

    const tpDistancePrice = effectiveTP > effectiveEntry ? effectiveTP - effectiveEntry : 0;
    const tpDistancePercent = effectiveEntry > 0 ? (tpDistancePrice / effectiveEntry) * 100 : 0;

    const rrRatio = slDistancePrice > 0 && tpDistancePrice > 0 ? tpDistancePrice / slDistancePrice : 0;

    // Currency rate multiplier
    const rate = currency === 'USD' ? kursIdrUsd : 1;
    const slDistanceInIdrPerUnit = slDistancePrice * rate;

    // Position Sizing: How many units can we buy so that when SL hits, loss = riskAmountIdr?
    const rawUnits = slDistanceInIdrPerUnit > 0 ? riskAmountIdr / slDistanceInIdrPerUnit : 0;
    const recommendedUnits = Number(rawUnits.toFixed(currency === 'USD' ? 3 : 0));
    const recommendedLots = currency === 'IDR' ? Math.floor(rawUnits / 100) : rawUnits;

    const allocatedCapitalIdr = rawUnits * effectiveEntry * rate;
    const potentialProfitIdr = tpDistancePrice > 0 ? rawUnits * tpDistancePrice * rate : 0;

    return {
      isValid: true,
      riskAmountIdr,
      slDistancePrice,
      slDistancePercent,
      tpDistancePrice,
      tpDistancePercent,
      rrRatio,
      recommendedUnits,
      recommendedLots,
      allocatedCapitalIdr,
      potentialProfitIdr,
      error: effectiveSL >= effectiveEntry ? 'Stop Loss untuk posisi BUY harus berada di bawah Harga Entry' : null,
    };
  }, [totalCapital, riskPercent, currency, kursIdrUsd, entryPrice, stopLossPrice, takeProfitPrice]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    const summary = `[Apex Risk Plan - ${assetSymbol.toUpperCase()}]
• Modal Akun: Rp ${Math.round(totalCapital).toLocaleString('id-ID')}
• Resiko (${riskPercent}%): Rp ${Math.round(calc.riskAmountIdr).toLocaleString('id-ID')}
• Entry: ${currency === 'USD' ? '$' : 'Rp '}${entryPrice}
• Stop Loss: ${currency === 'USD' ? '$' : 'Rp '}${stopLossPrice} (-${calc.slDistancePercent.toFixed(2)}%)
• Take Profit: ${currency === 'USD' ? '$' : 'Rp '}${takeProfitPrice} (+${calc.tpDistancePercent.toFixed(2)}%)
• Risk to Reward: 1 : ${calc.rrRatio.toFixed(2)}
• Max Size Rekomendasi: ${calc.recommendedUnits} ${currency === 'USD' ? 'shares' : 'lembar'} (${currency === 'IDR' ? `${calc.recommendedLots} lot` : ''})
• Alokasi Modal Dibutuhkan: Rp ${Math.round(calc.allocatedCapitalIdr).toLocaleString('id-ID')}
• Potensi Profit: Rp ${Math.round(calc.potentialProfitIdr).toLocaleString('id-ID')}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToForm = () => {
    if (!onApplyPlan || !calc.isValid) return;
    onApplyPlan({
      asset: assetSymbol.toUpperCase().trim(),
      entryPrice: Number(entryPrice),
      nominalIdr: Math.round(calc.allocatedCapitalIdr),
      jumlah: calc.recommendedUnits,
      kursIdrUsd: currency === 'USD' ? kursIdrUsd : 1,
      notes: `Pre-trade Plan: Risk ${riskPercent}% | SL: ${stopLossPrice} | TP: ${takeProfitPrice} | RR 1:${calc.rrRatio.toFixed(2)}`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-5 text-xs text-[#1c1917] dark:text-white space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e0d5] dark:border-[#1a2233]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#1c1917] dark:text-white">
                Kalkulator Manajemen Risiko &amp; Position Sizing
              </h2>
              <p className="text-[11px] text-[#6e685f] dark:text-slate-400 mt-0.5">
                Hitung batas resiko maksimal dan alokasi lot ideal sebelum melakukan entry
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8a8377] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#161d2d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Capital & Risk */}
          <div className="space-y-3 p-3.5 rounded-xl bg-[#faf8f4] dark:bg-[#090c12] border border-[#e5e0d5] dark:border-[#1a2233]">
            <span className="text-[11px] font-semibold text-[#1c1917] dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Modal &amp; Parameter Toleransi Risiko</span>
            </span>

            <div>
              <label className="block text-[11px] text-[#6e685f] dark:text-slate-400 mb-1">
                Total Modal Portofolio Aktif (IDR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={totalCapital}
                  onChange={e => setTotalCapital(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-3 py-1.5 text-xs font-mono font-medium focus:outline-none focus:border-blue-600 dark:focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-[#8a8377] dark:text-slate-500 mt-1">
                Terformat: {formatPrivacyIdr(totalCapital)}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#6e685f] dark:text-slate-400">
                  Toleransi Resiko per Trade (% Capital)
                </label>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-xs">
                  {riskPercent}% = {formatPrivacyIdr(calc.riskAmountIdr)}
                </span>
              </div>
              {/* Preset buttons */}
              <div className="flex gap-1.5 mb-1.5">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    className={`flex-1 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                      riskPercent === pct
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-[#ffffff] dark:bg-[#101520] text-[#57534e] dark:text-slate-400 border border-[#ded8cb] dark:border-[#1e2638] hover:bg-[#f5f2ea]'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.1"
                value={riskPercent}
                onChange={e => setRiskPercent(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-[#e5e0d5] dark:border-[#1a2233] flex items-center justify-between text-[11px]">
              <span className="text-[#6e685f] dark:text-slate-400">Mata Uang Aset</span>
              <div className="flex items-center gap-1 bg-[#ffffff] dark:bg-[#101520] p-0.5 rounded-md border border-[#ded8cb] dark:border-[#1e2638]">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    currency === 'USD' ? 'bg-blue-600 text-white' : 'text-[#6e685f] dark:text-slate-400'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('IDR')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    currency === 'IDR' ? 'bg-blue-600 text-white' : 'text-[#6e685f] dark:text-slate-400'
                  }`}
                >
                  IDR (Rp)
                </button>
              </div>
            </div>

            {currency === 'USD' && (
              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-0.5">
                  Kurs Acuan IDR/USD
                </label>
                <input
                  type="number"
                  value={kursIdrUsd}
                  onChange={e => setKursIdrUsd(Number(e.target.value))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Right Column: Asset, Entry, SL, TP */}
          <div className="space-y-3 p-3.5 rounded-xl bg-[#faf8f4] dark:bg-[#090c12] border border-[#e5e0d5] dark:border-[#1a2233]">
            <span className="text-[11px] font-semibold text-[#1c1917] dark:text-white flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Target Level Harga Entry &amp; Exit</span>
            </span>

            <div>
              <label className="block text-[11px] text-[#6e685f] dark:text-slate-400 mb-1">
                Simbol Aset / Ticker
              </label>
              <input
                type="text"
                value={assetSymbol}
                onChange={e => setAssetSymbol(e.target.value.toUpperCase())}
                placeholder="NVDA, BBCA, GOLD..."
                className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-3 py-1.5 text-xs font-mono font-semibold uppercase focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-[#6e685f] dark:text-slate-400 mb-1">
                  Entry Price
                </label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={e => setEntryPrice(Number(e.target.value))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-rose-600 dark:text-rose-400 mb-1">
                  Stop Loss (SL)
                </label>
                <input
                  type="number"
                  step="any"
                  value={stopLossPrice}
                  onChange={e => setStopLossPrice(Number(e.target.value))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-rose-300 dark:border-rose-500/30 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-rose-600 dark:text-rose-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                  Take Profit (TP)
                </label>
                <input
                  type="number"
                  step="any"
                  value={takeProfitPrice}
                  onChange={e => setTakeProfitPrice(Number(e.target.value))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-emerald-300 dark:border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>

            {/* Error or validation message */}
            {calc.error ? (
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{calc.error}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 font-mono">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/10">
                  <span className="text-[10px] text-rose-700 dark:text-rose-400 block">Jarak SL</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    -{calc.slDistancePercent.toFixed(2)}% ({calc.slDistancePrice.toFixed(2)})
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block">Jarak TP</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{calc.tpDistancePercent.toFixed(2)}% ({calc.tpDistancePrice.toFixed(2)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calculation Result Dashboard Card */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/5 via-[#f5f2ea] to-emerald-500/5 dark:from-blue-900/15 dark:via-[#101522] dark:to-emerald-900/15 border border-[#ded8cb] dark:border-[#1e2638] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e5e0d5] dark:border-[#1a2233]">
            <span className="text-xs font-semibold text-[#1c1917] dark:text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Rekomendasi Position Sizing &amp; Risk / Reward Ratio</span>
            </span>

            {/* R:R Badge */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#6e685f] dark:text-slate-400">R:R Ratio:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                  calc.rrRatio >= 2.0
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : calc.rrRatio >= 1.5
                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                }`}
              >
                1 : {calc.rrRatio.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xs">
              <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Maksimal Resiko (Loss)</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                -{formatPrivacyIdr(calc.riskAmountIdr)}
              </span>
              <span className="text-[9px] text-[#8a8377] block mt-0.5">{riskPercent}% total modal</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xs">
              <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Ukuran Posisi Ideal</span>
              <span className="font-mono font-bold text-[#1c1917] dark:text-white text-xs sm:text-sm">
                {calc.recommendedUnits.toLocaleString()} {currency === 'USD' ? 'shares' : 'lembar'}
              </span>
              {currency === 'IDR' && (
                <span className="text-[9px] text-blue-600 dark:text-blue-400 block mt-0.5">
                  ({calc.recommendedLots} lot)
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xs">
              <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Modal Dibutuhkan</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
                {formatPrivacyIdr(calc.allocatedCapitalIdr)}
              </span>
              <span className="text-[9px] text-[#8a8377] block mt-0.5">
                {totalCapital > 0 ? ((calc.allocatedCapitalIdr / totalCapital) * 100).toFixed(1) : 0}% alokasi portofolio
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xs">
              <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Potensi Laba (TP)</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                +{formatPrivacyIdr(calc.potentialProfitIdr)}
              </span>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                +{calc.tpDistancePercent.toFixed(1)}% gain
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ded8cb] dark:border-[#1e2638] bg-[#ffffff] dark:bg-[#101520] hover:bg-[#f5f2ea] text-xs font-medium text-[#44403c] dark:text-slate-300 transition-colors shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Ringkasan Rencana'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-[#ded8cb] dark:border-[#1e2638] hover:bg-[#f5f2ea] dark:hover:bg-[#161d2d] text-xs font-medium text-[#57534e] dark:text-slate-400 transition-colors"
            >
              Tutup
            </button>
            {onApplyPlan && (
              <button
                type="button"
                onClick={handleApplyToForm}
                disabled={!calc.isValid || !!calc.error}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-colors disabled:opacity-50"
              >
                <span>Terapkan ke Form Transaksi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
