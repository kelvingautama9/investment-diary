import React, { useMemo } from 'react';
import type { InvestmentRecord, DateFilter, DateFilterPreset, AssetSummary } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import { DetailedEquityChart } from './DetailedEquityChart';
import { AssetPerformanceHeatmap } from './AssetPerformanceHeatmap';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Layers,
  Coins,
  CheckCircle2,
} from 'lucide-react';

interface InvestmentDashboardProps {
  records: InvestmentRecord[];
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  onSelectAssetForChart?: (symbol: string) => void;
}

export const InvestmentDashboard: React.FC<InvestmentDashboardProps> = ({
  records,
  dateFilter,
  onDateFilterChange,
  onSelectAssetForChart,
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
    const assetMap: Record<string, { totalBuyCost: number; totalQty: number; currentPrice: number; totalValIdr: number }> = {};

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
    });
  }, [records]);

  // Grand Total of floating asset value
  const grandTotalFloatingVal = assetSummaries.reduce((acc, a) => acc + a.valueTotalIdr, 0);

  const presets: Array<{ id: DateFilterPreset; label: string }> = [
    { id: 'ALL', label: 'Semua' },
    { id: '1D', label: '1 Hari' },
    { id: '7D', label: '7 Hari' },
    { id: '30D', label: '30 Hari' },
    { id: '90D', label: '90 Hari' },
    { id: 'YTD', label: 'YTD' },
    { id: '1Y', label: '1 Tahun' },
    { id: 'CUSTOM', label: 'Kustom' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Filter & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-[#0f131c] border border-[#1e2638]">
        <div className="flex items-center flex-wrap gap-1.5">
          <div className="flex items-center gap-1.5 px-2 text-slate-400 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-medium">Periode:</span>
          </div>

          <div className="flex items-center gap-1 bg-[#090b10] p-0.5 rounded-lg border border-[#1a2233] overflow-x-auto no-scrollbar">
            {presets.map(item => {
              const isActive = dateFilter.preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDateFilterChange({ ...dateFilter, preset: item.id })}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#182030] text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {dateFilter.preset === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs px-2">
            <input
              type="date"
              value={dateFilter.startDate || ''}
              onChange={e => onDateFilterChange({ ...dateFilter, startDate: e.target.value })}
              className="bg-[#090b10] border border-[#1e2638] rounded-md px-2 py-1 text-white text-xs font-mono"
            />
            <span className="text-slate-500">s/d</span>
            <input
              type="date"
              value={dateFilter.endDate || ''}
              onChange={e => onDateFilterChange({ ...dateFilter, endDate: e.target.value })}
              className="bg-[#090b10] border border-[#1e2638] rounded-md px-2 py-1 text-white text-xs font-mono"
            />
          </div>
        )}

        <div className="text-xs text-slate-400 px-2 sm:text-right">
          Menampilkan <span className="font-semibold text-white font-mono">{filteredRecords.length}</span> dari{' '}
          <span className="font-mono">{records.length}</span> transaksi
        </div>
      </div>

      {/* Executive Financial Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Nilai Portofolio (Focal Anchor) */}
        <div className="p-4 rounded-xl bg-[#0f131c] border border-[#1e2638]">
          <span className="text-xs text-slate-400 font-medium block">Total Nilai Portofolio Aktif</span>
          <div className="text-2xl font-bold text-white mt-1.5 font-mono tabular-nums tracking-tight">
            Rp {grandTotalFloatingVal.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>{metrics.floatingCount} posisi floating</span>
            <span className="font-mono">USD/IDR ~17.868</span>
          </div>
        </div>

        {/* Metric 2: Total Laba Bersih & ROI */}
        <div className="p-4 rounded-xl bg-[#0f131c] border border-[#1e2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Laba Bersih</span>
            <span
              className={`text-xs font-bold font-mono ${
                metrics.netRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ROI {metrics.netRoi >= 0 ? '+' : ''}{metrics.netRoi.toFixed(2)}%
            </span>
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono tabular-nums tracking-tight flex items-center gap-1 ${
              metrics.totalLabaBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {metrics.totalLabaBersih >= 0 ? (
              <ArrowUpRight className="w-5 h-5 shrink-0" />
            ) : (
              <ArrowDownRight className="w-5 h-5 shrink-0" />
            )}
            <span>
              {metrics.totalLabaBersih >= 0 ? '+' : ''}Rp {Math.round(metrics.totalLabaBersih).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Akumulasi Realized + Floating
          </div>
        </div>

        {/* Metric 3: Modal Masuk Aktif */}
        <div className="p-4 rounded-xl bg-[#0f131c] border border-[#1e2638]">
          <span className="text-xs text-slate-400 font-medium block">Modal Masuk Aktif</span>
          <div className="text-2xl font-bold text-white mt-1.5 font-mono tabular-nums tracking-tight">
            Rp {Math.round(metrics.totalNominalIdr).toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Floating Gain:</span>
            <span
              className={`font-mono font-medium ${
                metrics.floatingGains >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.floatingGains >= 0 ? '+' : ''}Rp {Math.round(metrics.floatingGains).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Metric 4: Kinerja Realized Transaksi */}
        <div className="p-4 rounded-xl bg-[#0f131c] border border-[#1e2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Laba Terealisasi (Closed)</span>
            <span className="text-xs text-slate-300 font-mono">
              Win Rate: {metrics.winRate.toFixed(0)}%
            </span>
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 font-mono tabular-nums tracking-tight ${
              metrics.realizedGains >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {metrics.realizedGains >= 0 ? '+' : ''}Rp {Math.round(metrics.realizedGains).toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {metrics.winCount} menang dari {metrics.closedCount} transaksi selesai
          </div>
        </div>
      </div>

      {/* Cumulative Equity Growth Chart Component */}
      <DetailedEquityChart records={filteredRecords} />

      {/* Asset Performance Heatmap */}
      <AssetPerformanceHeatmap
        records={filteredRecords}
        onSelectAsset={onSelectAssetForChart}
      />

      {/* Summary Table: Ringkasan Aset Portofolio Aktif (Floating) */}
      <div className="rounded-xl bg-[#0f131c] border border-[#1e2638] overflow-hidden">
        <div className="p-4 border-b border-[#1a2233] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Ringkasan Aset Portofolio Aktif (Floating)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Konsolidasi posisi terbuka berdasarkan kolom P–S Google Sheet
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {assetSummaries.length} Aset
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#1a2233] bg-[#090b10]/60">
                <th className="py-2.5 px-4 font-medium">Aset</th>
                <th className="py-2.5 px-4 font-medium text-right">Rata-Rata Beli</th>
                <th className="py-2.5 px-4 font-medium text-right">Harga Saat Ini</th>
                <th className="py-2.5 px-4 font-medium text-right">PnL (%)</th>
                <th className="py-2.5 px-4 font-medium text-right">Total Nilai (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171d2c]">
              {assetSummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    Belum ada aset aktif (Floating). Hubungkan Google Sheet untuk memuat data transaksi.
                  </td>
                </tr>
              ) : (
                assetSummaries.map(a => (
                  <tr
                    key={a.asset}
                    className="hover:bg-[#141a27] transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-white font-mono">
                      {a.asset}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300 font-mono tabular-nums">
                      ${a.averageBuy.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-4 text-right text-white font-medium font-mono tabular-nums">
                      ${a.priceNow.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono tabular-nums">
                      <span className={a.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {a.pnlPercent >= 0 ? '+' : ''}{a.pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-100 font-semibold font-mono tabular-nums">
                      Rp {a.valueTotalIdr.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {assetSummaries.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#1a2233] bg-[#090b10]/80">
                  <td colSpan={4} className="py-3 px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Total Nilai Aset Portofolio
                  </td>
                  <td className="py-3 px-4 text-right text-base font-bold text-white font-mono tabular-nums">
                    Rp {grandTotalFloatingVal.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
