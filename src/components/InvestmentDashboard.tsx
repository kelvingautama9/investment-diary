import React, { useMemo } from 'react';
import type { InvestmentRecord, DateFilter, DateFilterPreset, AssetSummary } from '../types';
import { DetailedEquityChart } from './DetailedEquityChart';
import { AssetPerformanceHeatmap } from './AssetPerformanceHeatmap';
import {
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  PieChart,
  DollarSign,
  Layers,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

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
  // Apply date filter
  const filteredRecords = useMemo(() => {
    if (records.length === 0) return [];
    const now = new Date();

    return records.filter(rec => {
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
        // Hanya yang statusnya Floating yang dihitung sebagai modal masuk aktif
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
      closedCount,
      floatingCount,
    };
  }, [filteredRecords]);

  // Group by Asset Summary (Matching columns P:S in user spreadsheet)
  const assetSummaries: AssetSummary[] = useMemo(() => {
    const floatingRecords = records.filter(r => r.status === 'Floating');
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

  const presets: DateFilterPreset[] = ['ALL', '1D', '7D', '30D', '90D', 'YTD', '1Y', 'CUSTOM'];

  return (
    <div className="space-y-4 select-none">
      {/* Date Filter Bar */}
      <div className="p-3 rounded-2xl bg-[#10141f] border border-[#1b2234] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-white">Filter Periode:</span>
          <div className="flex items-center gap-1 bg-[#0b0e17]/80 p-1 rounded-xl border border-[#1e273d] backdrop-blur-md">
            {presets.map(preset => {
              const isActive = dateFilter.preset === preset;
              return (
                <LiquidButton
                  key={preset}
                  onClick={() => onDateFilterChange({ ...dateFilter, preset })}
                  variant={isActive ? 'primary' : 'ghost'}
                  size="sm"
                  className={`h-7 px-2.5 text-xs ${
                    isActive
                      ? 'font-bold shadow-[0_2px_12px_rgba(37,99,235,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {preset}
                </LiquidButton>
              );
            })}
          </div>
        </div>

        {dateFilter.preset === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={dateFilter.startDate || ''}
              onChange={e => onDateFilterChange({ ...dateFilter, startDate: e.target.value })}
              className="bg-[#0b0e17] border border-[#1e273d] rounded-lg px-2.5 py-1 text-white text-xs"
            />
            <span className="text-slate-500">s/d</span>
            <input
              type="date"
              value={dateFilter.endDate || ''}
              onChange={e => onDateFilterChange({ ...dateFilter, endDate: e.target.value })}
              className="bg-[#0b0e17] border border-[#1e273d] rounded-lg px-2.5 py-1 text-white text-xs"
            />
          </div>
        )}

        <div className="text-xs text-slate-400">
          Data Terfilter: <strong className="text-blue-400 font-semibold">{filteredRecords.length}</strong> dari {records.length} Transaksi
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Modal Investasi */}
        <div className="p-4 rounded-2xl bg-[#10141f] border border-[#1b2234]">
          <span className="text-xs font-medium text-slate-400 block">Total Modal Masuk</span>
          <span className="text-xl font-bold text-white block mt-1">
            Rp {Math.round(metrics.totalNominalIdr).toLocaleString('id-ID')}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {metrics.floatingCount} posisi floating aktif
          </span>
        </div>

        {/* Total Laba Bersih */}
        <div className="p-4 rounded-2xl bg-[#10141f] border border-[#1b2234]">
          <span className="text-xs font-medium text-slate-400 block">Total Laba Bersih</span>
          <div className="flex items-center gap-1.5 mt-1">
            {metrics.totalLabaBersih >= 0 ? (
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
            )}
            <span
              className={`text-xl font-bold ${
                metrics.totalLabaBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.totalLabaBersih >= 0 ? '+' : ''}Rp {Math.round(metrics.totalLabaBersih).toLocaleString('id-ID')}
            </span>
          </div>
          <span
            className={`text-[11px] font-semibold mt-1 block ${
              metrics.netRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ROI Bersih: {metrics.netRoi >= 0 ? '+' : ''}{metrics.netRoi.toFixed(2)}%
          </span>
        </div>

        {/* Realized vs Floating */}
        <div className="p-4 rounded-2xl bg-[#10141f] border border-[#1b2234]">
          <span className="text-xs font-medium text-slate-400 block">Status Laba</span>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Realized:</span>
              <span className={`font-semibold ${metrics.realizedGains >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Rp {Math.round(metrics.realizedGains).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Floating:</span>
              <span className={`font-semibold ${metrics.floatingGains >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Rp {Math.round(metrics.floatingGains).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {metrics.closedCount} Realized • {metrics.floatingCount} Floating
          </span>
        </div>

        {/* Grand Total Nilai Aset Floating */}
        <div className="p-4 rounded-2xl bg-[#10141f] border border-[#1b2234]">
          <span className="text-xs font-medium text-slate-400 block">Total Nilai Aset Aktif</span>
          <span className="text-xl font-bold text-blue-400 block mt-1">
            Rp {grandTotalFloatingVal.toLocaleString('id-ID')}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Kurs USD/IDR Acuan: <strong>17.868</strong>
          </span>
        </div>
      </div>

      {/* The Detailed Cumulative Equity Growth Chart (White Line as requested) */}
      <DetailedEquityChart records={filteredRecords} />

      {/* Visual Performance Heatmap: Asset Profitability Distribution */}
      <AssetPerformanceHeatmap
        records={filteredRecords}
        onSelectAsset={onSelectAssetForChart}
      />

      {/* Summary Table: Ringkasan Aset Aktif Floating (Columns P:S from user Google Sheet) */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234]">
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2234]">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white tracking-tight">
              Ringkasan Aset Portofolio Aktif (Floating)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Kolom P–S Google Sheet</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] font-semibold text-slate-400 border-b border-[#1b2234]">
                <th className="pb-2.5">ASSET</th>
                <th className="pb-2.5 text-right">AVERAGE BUY</th>
                <th className="pb-2.5 text-right">PRICE NOW</th>
                <th className="pb-2.5 text-right">PnL (%)</th>
                <th className="pb-2.5 text-right">VALUE TOTAL (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171d2c]">
              {assetSummaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    Belum ada aset aktif (Floating). Hubungkan Google Sheet Anda untuk memuat aset portofolio.
                  </td>
                </tr>
              ) : (
                assetSummaries.map(a => (
                  <tr
                    key={a.asset}
                    className="hover:bg-[#141b29] transition-colors"
                  >
                    <td className="py-3 font-bold text-white">
                      {a.asset}
                    </td>
                    <td className="py-3 text-right text-slate-300">
                      ${a.averageBuy.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 text-right text-white font-medium">
                      ${a.priceNow.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 text-right font-bold">
                      <span className={a.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {a.pnlPercent >= 0 ? '+' : ''}{a.pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-slate-200 font-semibold">
                      Rp {a.valueTotalIdr.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-3 mt-3 border-t border-[#1b2234] flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">GRAND TOTAL NILAI ASET</span>
          <span className="font-bold text-white text-base">
            Rp {grandTotalFloatingVal.toLocaleString('id-ID')}
          </span>
        </div>
      </div>
    </div>
  );
};
