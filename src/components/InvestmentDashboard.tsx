import React, { useMemo, useState } from 'react';
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

  // Top gainer and loser
  const topWinner = useMemo(() => {
    if (assetSummaries.length === 0) return null;
    const sorted = [...assetSummaries].sort((a, b) => b.pnlPercent - a.pnlPercent);
    return sorted[0];
  }, [assetSummaries]);

  const worstLoser = useMemo(() => {
    if (assetSummaries.length === 0) return null;
    const sorted = [...assetSummaries].sort((a, b) => a.pnlPercent - b.pnlPercent);
    return sorted[0];
  }, [assetSummaries]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#1a2233]">
        <div>
          <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span>Ringkasan Portofolio &amp; Kinerja Investasi</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Database Google Sheet · Konsolidasi posisi terbuka dan tertutup
          </p>
        </div>

        {/* Compact Period Preset Strip */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <div className="flex items-center gap-0.5 bg-[#0c0f17] p-0.5 rounded-md border border-[#1e2638]">
            {presets.map(item => {
              const isActive = dateFilter.preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDateFilterChange({ ...dateFilter, preset: item.id })}
                  className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#182030] text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
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
                className="bg-[#0c0f17] border border-[#1e2638] rounded px-1.5 py-0.5 text-white text-[11px] font-mono"
              />
              <span className="text-slate-500 text-[10px]">s/d</span>
              <input
                type="date"
                value={dateFilter.endDate || ''}
                onChange={e => onDateFilterChange({ ...dateFilter, endDate: e.target.value })}
                className="bg-[#0c0f17] border border-[#1e2638] rounded px-1.5 py-0.5 text-white text-[11px] font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Two-Column Financial Expert Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Section (col-span-8): Equity Chart, Highlights, and Open Position Table */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Detailed Equity Chart (Compact height ~270px) */}
          <DetailedEquityChart records={filteredRecords} />

          {/* Quick Highlights Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {topWinner && (
              <div className="p-2.5 rounded-lg bg-[#0c0f17] border border-emerald-500/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                    Top Performer
                  </span>
                  <span className="text-white font-semibold text-xs flex items-center gap-1.5 mt-0.5">
                    {topWinner.asset}
                    <span className="font-mono text-emerald-400 text-[11px]">
                      +{topWinner.pnlPercent.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <span className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 tabular-nums">
                  Rp {Math.round(topWinner.valueTotalIdr / 1000000)} Jt
                </span>
              </div>
            )}

            {worstLoser && (
              <div className="p-2.5 rounded-lg bg-[#0c0f17] border border-rose-500/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                    Underperformer
                  </span>
                  <span className="text-white font-semibold text-xs flex items-center gap-1.5 mt-0.5">
                    {worstLoser.asset}
                    <span className="font-mono text-rose-400 text-[11px]">
                      {worstLoser.pnlPercent.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <span className="text-[11px] font-mono font-medium text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 tabular-nums">
                  Rp {Math.round(worstLoser.valueTotalIdr / 1000000)} Jt
                </span>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-[#0c0f17] border border-[#1e2638] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                  Aktivitas Transaksi
                </span>
                <span className="text-slate-200 font-semibold text-xs block mt-0.5 font-mono">
                  {filteredRecords.length} posisi tercatat
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {metrics.floatingCount} aktif
              </span>
            </div>
          </div>

          {/* Compact Open Positions (Floating) Table */}
          <div className="rounded-xl bg-[#0c0f17] border border-[#1e2638] overflow-hidden">
            <div className="p-3 border-b border-[#1a2233] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <h3 className="text-xs font-semibold text-white tracking-tight">
                  Ringkasan Posisi Portofolio Aktif (Floating)
                </h3>
              </div>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('ledger')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <span>Lihat Seluruh Transaksi</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-[#1a2233] bg-[#090c12] text-[10px] uppercase tracking-wider font-mono">
                    <th className="py-2 px-3 font-medium">Aset</th>
                    <th className="py-2 px-3 font-medium text-right">Rata-Rata Beli</th>
                    <th className="py-2 px-3 font-medium text-right">Harga Sekarang</th>
                    <th className="py-2 px-3 font-medium text-right">Imbal Hasil (ROI)</th>
                    <th className="py-2 px-3 font-medium text-right">Total Nilai (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171e2e]">
                  {assetSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        Belum ada posisi terbuka terdeteksi. Hubungkan Google Sheet untuk memuat data.
                      </td>
                    </tr>
                  ) : (
                    assetSummaries.map(a => (
                      <tr
                        key={a.asset}
                        onClick={() => onSelectAssetForChart && onSelectAssetForChart(a.asset)}
                        className="hover:bg-[#121724] transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3 font-semibold text-white font-mono">
                          {a.asset}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono tabular-nums">
                          ${a.averageBuy.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-200 font-medium font-mono tabular-nums">
                          ${a.priceNow.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold font-mono tabular-nums">
                          <span className={a.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {a.pnlPercent >= 0 ? '+' : ''}{a.pnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-100 font-semibold font-mono tabular-nums">
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

        {/* Right Section (col-span-4): Executive Final Card (Directly inspired by reference image!) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Main Executive Balance Card */}
          <div className="rounded-xl bg-[#0c0f17] border border-[#1e2638] p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium">Total Nilai Portofolio (Aktif)</span>
                <span className="font-mono text-slate-500">USD/IDR ~17.868</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Konsolidasi {metrics.floatingCount} Posisi Terbuka
              </p>
            </div>

            {/* Focal Big Metric (Warm / Authoritative Numbers) */}
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-200/90 tabular-nums">
              Rp {grandTotalFloatingVal.toLocaleString('id-ID')}
            </div>

            {/* Net ROI & Profit Highlight Banner (Matching the orange/warm banner in reference image) */}
            <div className="p-3 rounded-lg bg-[#1a1412] border border-amber-900/40 text-xs space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-amber-400/80 font-medium block">
                Laba Bersih Akumulasi
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold font-mono text-amber-300 tabular-nums">
                  {metrics.totalLabaBersih >= 0 ? '+' : ''}Rp {Math.round(metrics.totalLabaBersih).toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  {metrics.netRoi >= 0 ? '+' : ''}{metrics.netRoi.toFixed(2)}% ROI
                </span>
              </div>
            </div>

            {/* Details Grid (Modal Masuk, Floating Gain, Win Rate) */}
            <div className="pt-2 border-t border-[#1a2233] space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[11px]">Modal Masuk Aktif:</span>
                <span className="font-mono font-medium tabular-nums">
                  Rp {Math.round(metrics.totalNominalIdr).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[11px]">Floating Gains:</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    metrics.floatingGains >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {metrics.floatingGains >= 0 ? '+' : ''}Rp {Math.round(metrics.floatingGains).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[11px]">Laba Terealisasi:</span>
                <span
                  className={`font-mono font-medium tabular-nums ${
                    metrics.realizedGains >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {metrics.realizedGains >= 0 ? '+' : ''}Rp {Math.round(metrics.realizedGains).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-[#171e2e]">
                <span className="text-slate-400 text-[11px]">Win Rate Selesai:</span>
                <span className="font-mono font-semibold text-white">
                  {metrics.winRate.toFixed(0)}% ({metrics.winCount}/{metrics.closedCount} Menang)
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            {onOpenAddModal && (
              <div className="pt-2 border-t border-[#1a2233]">
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
