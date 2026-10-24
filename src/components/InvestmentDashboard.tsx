import React, { useState, useMemo } from 'react';
import type { InvestmentRecord, DateFilter, DateFilterPreset, AssetSummary, ActivePage } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import { DetailedEquityChart } from './DetailedEquityChart';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Layers,
  Percent,
  Coins,
} from 'lucide-react';

interface InvestmentDashboardProps {
  records: InvestmentRecord[];
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  onSelectAssetForChart?: (symbol: string) => void;
  onOpenAddModal?: () => void;
  onNavigateToTab?: (page: ActivePage) => void;
}

export const InvestmentDashboard: React.FC<InvestmentDashboardProps> = ({
  records,
  dateFilter,
  onDateFilterChange,
  onSelectAssetForChart,
  onOpenAddModal,
  onNavigateToTab,
}) => {
  // Apply date filter & strict non-investment filter (removes any transport/expense items)
  const filteredRecords = useMemo(() => {
    if (records.length === 0) return [];
    const now = new Date();

    return records.filter(rec => {
      if (isNonInvestmentOrExpense(rec.asset) || isNonInvestmentOrExpense(rec.type)) return false;
      if (!rec.entryDate) return true;
      const recDate = new Date(rec.entryDate);

      if (dateFilter.preset === 'ALL') return true;

      if (dateFilter.preset === 'CUSTOM') {
        if (dateFilter.startDate && recDate < new Date(dateFilter.startDate)) return false;
        if (dateFilter.endDate && recDate > new Date(dateFilter.endDate + 'T23:59:59')) return false;
        return true;
      }

      let days = 30;
      if (dateFilter.preset === '1D') days = 1;
      else if (dateFilter.preset === '7D') days = 7;
      else if (dateFilter.preset === '30D') days = 30;
      else if (dateFilter.preset === '90D') days = 90;
      else if (dateFilter.preset === '1Y') days = 365;
      else if (dateFilter.preset === 'YTD') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return recDate >= startOfYear;
      }

      const diffTime = now.getTime() - recDate.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      return diffDays <= days;
    });
  }, [records, dateFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalNominalIdr = 0;
    let totalLabaBersih = 0;
    let totalNilaiAsetFloating = 0;
    let realizedGains = 0;
    let floatingGains = 0;
    let winCount = 0;
    let closedCount = 0;

    filteredRecords.forEach(rec => {
      totalLabaBersih += rec.labaBersih || 0;

      if (rec.status === 'Realized') {
        closedCount++;
        realizedGains += rec.labaBersih || 0;
        if (rec.labaBersih > 0) winCount++;
      } else {
        totalNominalIdr += rec.nominalIdr || 0;
        floatingGains += rec.labaBersih || 0;
        totalNilaiAsetFloating += rec.nilaiAset || 0;
      }
    });

    const netRoi = totalNominalIdr > 0 ? (totalLabaBersih / totalNominalIdr) * 100 : 0;
    const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : 0;
    const floatingCount = filteredRecords.filter(r => r.status === 'Floating').length;

    return {
      totalNominalIdr,
      totalLabaBersih,
      totalNilaiAsetFloating,
      realizedGains,
      floatingGains,
      netRoi,
      winRate,
      winCount,
      closedCount,
      floatingCount,
    };
  }, [filteredRecords]);

  // Group by Asset Summary (Columns P:S in user spreadsheet)
  const assetSummaries: AssetSummary[] = useMemo(() => {
    const floatingRecords = records.filter(
      r => r.status === 'Floating' && !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type)
    );
    const assetMap: Record<
      string,
      { totalBuyCost: number; totalQty: number; currentPrice: number; totalValIdr: number }
    > = {};

    floatingRecords.forEach(r => {
      if (!assetMap[r.asset]) {
        assetMap[r.asset] = { totalBuyCost: 0, totalQty: 0, currentPrice: r.exitPrice || r.entryPrice, totalValIdr: 0 };
      }
      assetMap[r.asset].totalBuyCost += r.entryPrice * r.jumlah;
      assetMap[r.asset].totalQty += r.jumlah;
      assetMap[r.asset].totalValIdr += r.nilaiAset || 0;
      if (r.exitPrice) {
        assetMap[r.asset].currentPrice = r.exitPrice;
      }
    });

    return Object.keys(assetMap).map(asset => {
      const data = assetMap[asset];
      const avgBuy = data.totalQty > 0 ? data.totalBuyCost / data.totalQty : 0;
      const priceNow = data.currentPrice;
      const pnlPct = avgBuy > 0 ? ((priceNow - avgBuy) / avgBuy) * 100 : 0;

      return {
        asset,
        averageBuy: Number(avgBuy.toFixed(1)),
        priceNow: Number(priceNow.toFixed(1)),
        pnlPercent: Number(pnlPct.toFixed(2)),
        valueTotalIdr: Math.round(data.totalValIdr),
      };
    }).sort((a, b) => b.valueTotalIdr - a.valueTotalIdr);
  }, [records]);

  // Grand Total of floating asset value
  const grandTotalFloatingVal = assetSummaries.reduce((acc, a) => acc + a.valueTotalIdr, 0);

  // Highlight ranking filter: 'PERCENT' (% ROI) vs 'NOMINAL' (Rp Value)
  const [highlightBasis, setHighlightBasis] = useState<'PERCENT' | 'NOMINAL'>('PERCENT');

  // Top Performer and Underperformer with full 3-aspect calculations
  const { topWinner, worstLoser, totalPortfolioCapital } = useMemo(() => {
    const valid = filteredRecords.filter(
      r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type)
    );
    if (valid.length === 0) {
      return { topWinner: null, worstLoser: null, totalPortfolioCapital: 0 };
    }

    const map: Record<
      string,
      {
        asset: string;
        totalNominal: number;
        historicalNominal: number;
        totalLabaBersih: number;
        totalNilaiAset: number;
        avgPnlPercent: number;
        tradeCount: number;
        floatingCount: number;
      }
    > = {};

    let totalCap = 0;
    valid.forEach(r => {
      if (!map[r.asset]) {
        map[r.asset] = {
          asset: r.asset,
          totalNominal: 0,
          historicalNominal: 0,
          totalLabaBersih: 0,
          totalNilaiAset: 0,
          avgPnlPercent: 0,
          tradeCount: 0,
          floatingCount: 0,
        };
      }
      const nom = r.nominalIdr || (r.entryPrice * r.jumlah) || 0;
      map[r.asset].historicalNominal += nom;
      map[r.asset].totalLabaBersih += r.labaBersih || 0;
      map[r.asset].totalNilaiAset += r.nilaiAset || 0;
      map[r.asset].tradeCount += 1;
      if (r.status === 'Floating') {
        map[r.asset].floatingCount += 1;
        map[r.asset].totalNominal += nom;
        totalCap += nom;
      }
    });

    const list = Object.values(map).map(item => {
      const baseCost = item.totalNominal > 0 ? item.totalNominal : item.historicalNominal;
      return {
        ...item,
        avgPnlPercent: baseCost > 0 ? (item.totalLabaBersih / baseCost) * 100 : 0,
        capitalShare: totalCap > 0 && item.totalNominal > 0 ? (item.totalNominal / totalCap) * 100 : 0,
      };
    });

    if (list.length === 0) {
      return { topWinner: null, worstLoser: null, totalPortfolioCapital: 0 };
    }

    let winner = list[0];
    let loser = list[0];

    if (highlightBasis === 'PERCENT') {
      const sortedByRoi = [...list].sort((a, b) => b.avgPnlPercent - a.avgPnlPercent);
      winner = sortedByRoi[0];
      loser = sortedByRoi[sortedByRoi.length - 1];
    } else {
      const sortedByNominal = [...list].sort((a, b) => b.totalLabaBersih - a.totalLabaBersih);
      winner = sortedByNominal[0];
      loser = sortedByNominal[sortedByNominal.length - 1];
    }

    return {
      topWinner: winner,
      worstLoser: loser,
      totalPortfolioCapital: totalCap,
    };
  }, [filteredRecords, highlightBasis]);

  const presets: Array<{ id: DateFilterPreset; label: string }> = [
    { id: 'ALL', label: 'Semua' },
    { id: '1D', label: '1D' },
    { id: '7D', label: '7D' },
    { id: '30D', label: '30D' },
    { id: '90D', label: '90D' },
    { id: 'YTD', label: 'YTD' },
    { id: '1Y', label: '1Y' },
    { id: 'CUSTOM', label: 'Kustom' },
  ];

  return (
    <div className="space-y-3.5 select-none">
      {/* 1. Page Header Title & Compact Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#e5e0d5] dark:border-[#1a2233]">
        <div>
          <h1 className="text-sm font-semibold text-[#1c1917] dark:text-white tracking-tight flex items-center gap-2">
            <span>Ringkasan Portofolio &amp; Kinerja Investasi</span>
          </h1>
          <p className="text-[11px] text-[#6e685f] dark:text-slate-400 mt-0.5">
            Database Google Sheet · Konsolidasi posisi terbuka dan tertutup
          </p>
        </div>

        {/* Compact Period Preset Strip */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div className="flex items-center gap-0.5 bg-[#efebe2] dark:bg-[#0c0f17] p-0.5 rounded-md border border-[#ded8cb] dark:border-[#1e2638]">
            {presets.map(item => {
              const isActive = dateFilter.preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDateFilterChange({ ...dateFilter, preset: item.id })}
                  className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                      : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {dateFilter.preset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={dateFilter.startDate || ''}
                onChange={e => onDateFilterChange({ ...dateFilter, startDate: e.target.value })}
                className="bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] rounded px-1.5 py-0.5 text-[#1c1917] dark:text-white text-[11px] font-mono"
              />
              <span className="text-[#8a8377] dark:text-slate-500 text-[10px]">s/d</span>
              <input
                type="date"
                value={dateFilter.endDate || ''}
                onChange={e => onDateFilterChange({ ...dateFilter, endDate: e.target.value })}
                className="bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] rounded px-1.5 py-0.5 text-[#1c1917] dark:text-white text-[11px] font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Two-Column Financial Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Section (col-span-8): Equity Chart, Highlights, and Open Position Table */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Detailed Equity Chart */}
          <DetailedEquityChart records={filteredRecords} />

          {/* Quick Highlights Row with Basis Filter Buttons & 3 Aspects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e685f] dark:text-slate-400">
                Sorotan Performa Portofolio
              </span>

              {/* Small Filtering Buttons to toggle between % ROI and Rp Nominal Value */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#8a8377] dark:text-slate-500 font-medium mr-1 hidden sm:inline">
                  Filter Sorotan:
                </span>
                <div className="flex items-center bg-[#efebe2] dark:bg-[#0c0f17] p-0.5 rounded-md border border-[#ded8cb] dark:border-[#1e2638]">
                  <button
                    type="button"
                    onClick={() => setHighlightBasis('PERCENT')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                      highlightBasis === 'PERCENT'
                        ? 'bg-[#ffffff] text-blue-700 dark:text-blue-400 shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#1a2233]'
                        : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Filter sorotan berdasarkan persentase ROI"
                  >
                    <Percent className="w-2.5 h-2.5" />
                    <span>% ROI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHighlightBasis('NOMINAL')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                      highlightBasis === 'NOMINAL'
                        ? 'bg-[#ffffff] text-blue-700 dark:text-blue-400 shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#1a2233]'
                        : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Filter sorotan berdasarkan nominal keuntungan/kerugian (Rp)"
                  >
                    <Coins className="w-2.5 h-2.5" />
                    <span>Nominal Rp</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Top Performer Card */}
              {topWinner && (
                <div
                  onClick={() => onSelectAssetForChart && onSelectAssetForChart(topWinner.asset)}
                  className="p-3 rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border-2 border-emerald-500/40 dark:border-emerald-500/30 flex flex-col justify-between shadow-2xs cursor-pointer hover:border-emerald-500 transition-colors"
                  title={`Klik untuk memfokuskan grafik pada ${topWinner.asset}`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/15">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Top Performer</span>
                      </span>
                      <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                        {highlightBasis === 'PERCENT' ? '% ROI' : 'Nominal Rp'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-bold text-sm text-[#1c1917] dark:text-white font-mono tracking-tight">
                        {topWinner.asset}
                      </span>
                      {/* Aspek 1: % ROI */}
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs tabular-nums">
                        +{topWinner.avgPnlPercent.toFixed(2)}% ROI
                      </span>
                    </div>

                    {/* Aspek 2: Nominal Laba Bersih */}
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-[#6e685f] dark:text-slate-400 text-[10px]">Laba Bersih:</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        +Rp {Math.round(topWinner.totalLabaBersih).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Aspek 3: Porsi Modal Portofolio */}
                  <div className="pt-2 mt-2 border-t border-[#ede8dc] dark:border-[#1a2233] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#6e685f] dark:text-slate-400">Porsi Modal Aktif:</span>
                      <span className="font-mono font-semibold text-[#1c1917] dark:text-white tabular-nums">
                        {topWinner.capitalShare.toFixed(1)}% ({topWinner.totalNominal > 0 ? `Rp ${Math.round(topWinner.totalNominal / 1000000)} Jt` : '0 Jt / Realized'})
                      </span>
                    </div>
                    <div className="w-full bg-[#e8e3d8] dark:bg-[#1a2233] h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, topWinner.capitalShare)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Underperformer Card */}
              {worstLoser && (
                <div
                  onClick={() => onSelectAssetForChart && onSelectAssetForChart(worstLoser.asset)}
                  className="p-3 rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border-2 border-rose-500/40 dark:border-rose-500/30 flex flex-col justify-between shadow-2xs cursor-pointer hover:border-rose-500 transition-colors"
                  title={`Klik untuk memfokuskan grafik pada ${worstLoser.asset}`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-rose-500/15">
                      <span className="text-[10px] uppercase tracking-wider text-rose-800 dark:text-rose-400 font-bold flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>Underperformer</span>
                      </span>
                      <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-500/20">
                        {highlightBasis === 'PERCENT' ? '% ROI' : 'Nominal Rp'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-bold text-sm text-[#1c1917] dark:text-white font-mono tracking-tight">
                        {worstLoser.asset}
                      </span>
                      {/* Aspek 1: % ROI */}
                      <span
                        className={`font-mono font-bold text-xs tabular-nums ${
                          worstLoser.avgPnlPercent >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {worstLoser.avgPnlPercent >= 0 ? '+' : ''}
                        {worstLoser.avgPnlPercent.toFixed(2)}% ROI
                      </span>
                    </div>

                    {/* Aspek 2: Nominal Laba/Rugi */}
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-[#6e685f] dark:text-slate-400 text-[10px]">Laba/Rugi:</span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          worstLoser.totalLabaBersih >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {worstLoser.totalLabaBersih >= 0 ? '+' : ''}Rp{' '}
                        {Math.round(worstLoser.totalLabaBersih).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Aspek 3: Porsi Modal Portofolio */}
                  <div className="pt-2 mt-2 border-t border-[#ede8dc] dark:border-[#1a2233] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#6e685f] dark:text-slate-400">Porsi Modal Aktif:</span>
                      <span className="font-mono font-semibold text-[#1c1917] dark:text-white tabular-nums">
                        {worstLoser.capitalShare.toFixed(1)}% ({worstLoser.totalNominal > 0 ? `Rp ${Math.round(worstLoser.totalNominal / 1000000)} Jt` : '0 Jt / Realized'})
                      </span>
                    </div>
                    <div className="w-full bg-[#e8e3d8] dark:bg-[#1a2233] h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-600 dark:bg-rose-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, worstLoser.capitalShare)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Activity & Health Card */}
              <div className="p-3 rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#e5e0d5] dark:border-[#1e2638] flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#ede8dc] dark:border-[#1a2233]">
                    <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-bold">
                      Aktivitas Transaksi
                    </span>
                    <span className="text-[9px] font-mono text-[#8a8377] dark:text-slate-500">
                      {dateFilter.preset}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#6e685f] dark:text-slate-400">Total Transaksi:</span>
                      <span className="font-mono font-semibold text-[#1c1917] dark:text-white">
                        {filteredRecords.length} posisi
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#6e685f] dark:text-slate-400">Posisi Aktif (Floating):</span>
                      <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                        {metrics.floatingCount} aset
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#6e685f] dark:text-slate-400">Posisi Selesai:</span>
                      <span className="font-mono font-medium text-[#1c1917] dark:text-slate-300">
                        {metrics.closedCount} realized
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-[#ede8dc] dark:border-[#1a2233] flex items-center justify-between text-[10px]">
                  <span className="text-[#6e685f] dark:text-slate-400">Win Rate:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {metrics.winRate.toFixed(0)}% Menang
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Open Positions (Floating) Table */}
          <div className="rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#e5e0d5] dark:border-[#1e2638] overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-[#e5e0d5] dark:border-[#1a2233] flex items-center justify-between bg-[#faf8f4] dark:bg-transparent">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-semibold text-[#1c1917] dark:text-white tracking-tight">
                  Ringkasan Posisi Portofolio Aktif (Floating)
                </h3>
              </div>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('ledger')}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <span>Lihat Seluruh Transaksi</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#6e685f] dark:text-slate-400 border-b border-[#e5e0d5] dark:border-[#1a2233] bg-[#f7f5ef] dark:bg-[#090c12] text-[10px] uppercase tracking-wider font-mono">
                    <th className="py-2 px-3 font-medium">Aset</th>
                    <th className="py-2 px-3 font-medium text-right">Rata-Rata Beli</th>
                    <th className="py-2 px-3 font-medium text-right">Harga Sekarang</th>
                    <th className="py-2 px-3 font-medium text-right">Imbal Hasil (ROI)</th>
                    <th className="py-2 px-3 font-medium text-right">Total Nilai (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ede8dc] dark:divide-[#171e2e]">
                  {assetSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#8a8377] dark:text-slate-500 text-xs">
                        Belum ada posisi terbuka terdeteksi. Hubungkan Google Sheet untuk memuat data.
                      </td>
                    </tr>
                  ) : (
                    assetSummaries.map(a => (
                      <tr
                        key={a.asset}
                        onClick={() => onSelectAssetForChart && onSelectAssetForChart(a.asset)}
                        className="hover:bg-[#f7f5ef] dark:hover:bg-[#121724] transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#1c1917] dark:text-white font-mono">
                          {a.asset}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#57534e] dark:text-slate-400 font-mono tabular-nums">
                          ${a.averageBuy.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#1c1917] dark:text-slate-200 font-medium font-mono tabular-nums">
                          ${a.priceNow.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold font-mono tabular-nums">
                          <span className={a.pnlPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                            {a.pnlPercent >= 0 ? '+' : ''}{a.pnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#1c1917] dark:text-slate-100 font-semibold font-mono tabular-nums">
                          Rp {a.valueTotalIdr.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Section (col-span-4): Executive Final Card */}
        <div className="lg:col-span-4 space-y-3">
          {/* Main Executive Balance Card */}
          <div className="rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#e5e0d5] dark:border-[#1e2638] p-4 space-y-3 shadow-2xs">
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#6e685f] dark:text-slate-400">
                <span className="font-medium">Total Nilai Portofolio (Aktif)</span>
                <span className="font-mono text-[#8a8377] dark:text-slate-500">USD/IDR ~17.868</span>
              </div>
              <p className="text-[10px] text-[#8a8377] dark:text-slate-500 font-mono mt-0.5">
                Konsolidasi {metrics.floatingCount} Posisi Terbuka
              </p>
            </div>

            {/* Focal Big Metric (Warm / Authoritative Numbers) */}
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#92400e] dark:text-amber-200/90 tabular-nums">
              Rp {grandTotalFloatingVal.toLocaleString('id-ID')}
            </div>

            {/* Net ROI & Profit Highlight Banner */}
            <div className="p-3 rounded-lg bg-[#fffbeb] dark:bg-[#1a1412] border border-[#fde68a] dark:border-amber-900/40 text-xs space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#92400e] dark:text-amber-400/80 font-semibold block">
                Laba Bersih Akumulasi
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold font-mono text-[#78350f] dark:text-amber-300 tabular-nums">
                  {metrics.totalLabaBersih >= 0 ? '+' : ''}Rp {Math.round(metrics.totalLabaBersih).toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {metrics.netRoi >= 0 ? '+' : ''}{metrics.netRoi.toFixed(2)}% ROI
                </span>
              </div>
            </div>

            {/* Details Grid (Modal Masuk, Floating Gain, Win Rate) */}
            <div className="pt-2 border-t border-[#ede8dc] dark:border-[#1a2233] space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                <span className="text-[#6e685f] dark:text-slate-400 text-[11px]">Modal Masuk Aktif:</span>
                <span className="font-mono font-medium tabular-nums text-[#1c1917] dark:text-slate-200">
                  Rp {Math.round(metrics.totalNominalIdr).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                <span className="text-[#6e685f] dark:text-slate-400 text-[11px]">Floating Gains:</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    metrics.floatingGains >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {metrics.floatingGains >= 0 ? '+' : ''}Rp {Math.round(metrics.floatingGains).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                <span className="text-[#6e685f] dark:text-slate-400 text-[11px]">Laba Terealisasi:</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    metrics.realizedGains >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {metrics.realizedGains >= 0 ? '+' : ''}Rp {Math.round(metrics.realizedGains).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#292524] dark:text-slate-300 pt-1 border-t border-[#ede8dc] dark:border-[#171e2e]">
                <span className="text-[#6e685f] dark:text-slate-400 text-[11px]">Win Rate Selesai:</span>
                <span className="font-mono font-semibold text-[#1c1917] dark:text-white">
                  {metrics.winRate.toFixed(0)}% ({metrics.winCount}/{metrics.closedCount} Menang)
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            {onOpenAddModal && (
              <div className="pt-2 border-t border-[#ede8dc] dark:border-[#1a2233]">
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="w-full py-2.5 px-3 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Posisi Baru</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
