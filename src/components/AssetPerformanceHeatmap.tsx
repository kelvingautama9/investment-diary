'use client';

import React, { useState, useMemo } from 'react';
import type { InvestmentRecord } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import {
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  Percent,
  DollarSign,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AssetPerformanceHeatmapProps {
  records: InvestmentRecord[];
  onSelectAsset?: (symbol: string) => void;
}

interface AggregatedAsset {
  asset: string;
  totalNominal: number;
  totalLabaBersih: number;
  totalNilaiAset: number;
  avgPnlPercent: number;
  tradeCount: number;
  realizedCount: number;
  floatingCount: number;
  bestTradePnlPercent: number;
  worstTradePnlPercent: number;
}

export const AssetPerformanceHeatmap: React.FC<AssetPerformanceHeatmapProps> = ({
  records,
  onSelectAsset,
}) => {
  // Scope filter: 'ALL' (Semua Aset), 'FLOATING' (Floating Saja), 'REALIZED' (Realized Saja)
  const [scope, setScope] = useState<'ALL' | 'FLOATING' | 'REALIZED'>('ALL');
  // Sort mode: 'PNL_DESC' (Best first), 'PNL_ASC' (Worst first), 'CAPITAL' (Highest capital)
  const [sortBy, setSortBy] = useState<'PNL_DESC' | 'PNL_ASC' | 'CAPITAL'>('PNL_DESC');
  // Display metric: 'PERCENT' (PnL %) or 'NOMINAL' (Rp Laba Bersih)
  const [displayMetric, setDisplayMetric] = useState<'PERCENT' | 'NOMINAL'>('PERCENT');
  // Sembunyikan / Tampilkan (Collapse / Expand)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  // Perkecil tampilan / Mode Kompak
  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Format IDR in short Jt / Rb
  const formatShortIdr = (num: number) => {
    const isNeg = num < 0;
    const abs = Math.abs(num);
    const prefix = isNeg ? '-Rp ' : '+Rp ';
    if (abs >= 1000000) {
      return `${prefix}${(abs / 1000000).toLocaleString('id-ID', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })} Jt`;
    }
    if (abs >= 1000) {
      return `${prefix}${Math.round(abs / 1000).toLocaleString('id-ID')} Rb`;
    }
    return `${prefix}${Math.round(abs).toLocaleString('id-ID')}`;
  };

  // Group records by Asset with Scope Filtering (Strictly excluding transport/expenses)
  const { assets, totalCapitalPool, topWinner, worstLoser, winRatio, totalProfit } = useMemo(() => {
    const validRecords = records.filter(r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type));

    const targetRecords =
      scope === 'FLOATING'
        ? validRecords.filter(r => r.status === 'Floating')
        : scope === 'REALIZED'
        ? validRecords.filter(r => r.status === 'Realized')
        : validRecords;

    if (targetRecords.length === 0) {
      return {
        assets: [],
        totalCapitalPool: 0,
        topWinner: null,
        worstLoser: null,
        winRatio: 0,
        totalProfit: 0,
      };
    }

    const map: Record<string, AggregatedAsset> = {};
    let runningNetProfit = 0;

    targetRecords.forEach(r => {
      runningNetProfit += r.labaBersih || 0;
      if (!map[r.asset]) {
        map[r.asset] = {
          asset: r.asset,
          totalNominal: 0,
          totalLabaBersih: 0,
          totalNilaiAset: 0,
          avgPnlPercent: 0,
          tradeCount: 0,
          realizedCount: 0,
          floatingCount: 0,
          bestTradePnlPercent: -Infinity,
          worstTradePnlPercent: Infinity,
        };
      }

      const item = map[r.asset];
      item.totalNominal += r.nominalIdr || 0;
      item.totalLabaBersih += r.labaBersih || 0;
      item.totalNilaiAset += r.nilaiAset || 0;
      item.tradeCount += 1;
      if (r.status === 'Realized') item.realizedCount += 1;
      else item.floatingCount += 1;

      if (r.pnlPercent > item.bestTradePnlPercent) item.bestTradePnlPercent = r.pnlPercent;
      if (r.pnlPercent < item.worstTradePnlPercent) item.worstTradePnlPercent = r.pnlPercent;
    });

    const totalPool = Object.values(map).reduce((sum, a) => sum + a.totalNominal, 0);

    const assetList = Object.values(map).map(a => {
      // Weighted ROI: (Total Laba Bersih / Total Nominal) * 100
      const weightedRoi = a.totalNominal > 0 ? (a.totalLabaBersih / a.totalNominal) * 100 : 0;
      return {
        ...a,
        avgPnlPercent: weightedRoi,
      };
    });

    // Sort according to selection
    assetList.sort((a, b) => {
      if (sortBy === 'PNL_DESC') return b.avgPnlPercent - a.avgPnlPercent;
      if (sortBy === 'PNL_ASC') return a.avgPnlPercent - b.avgPnlPercent;
      return b.totalNominal - a.totalNominal;
    });

    const winners = assetList.filter(a => a.totalLabaBersih >= 0);
    const winRate = assetList.length > 0 ? (winners.length / assetList.length) * 100 : 0;

    const sortedByProfit = [...assetList].sort((a, b) => b.totalLabaBersih - a.totalLabaBersih);
    const topW = sortedByProfit.length > 0 && sortedByProfit[0].totalLabaBersih > 0 ? sortedByProfit[0] : null;
    const worstL =
      sortedByProfit.length > 0 && sortedByProfit[sortedByProfit.length - 1].totalLabaBersih < 0
        ? sortedByProfit[sortedByProfit.length - 1]
        : null;

    return {
      assets: assetList,
      totalCapitalPool: totalPool,
      topWinner: topW,
      worstLoser: worstL,
      winRatio: Math.round(winRate),
      totalProfit: runningNetProfit,
    };
  }, [records, scope, sortBy]);

  // Color Intensity calculation based on PnL %
  const getHeatmapColor = (pnlPct: number) => {
    if (pnlPct >= 20) {
      return {
        bg: 'bg-emerald-500/20 hover:bg-emerald-500/30',
        border: 'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
        badge: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40',
        text: 'text-emerald-400',
      };
    }
    if (pnlPct >= 10) {
      return {
        bg: 'bg-emerald-600/15 hover:bg-emerald-600/25',
        border: 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]',
        badge: 'text-emerald-300 bg-emerald-600/20 border-emerald-500/30',
        text: 'text-emerald-400',
      };
    }
    if (pnlPct > 0) {
      return {
        bg: 'bg-teal-500/10 hover:bg-teal-500/20',
        border: 'border-teal-500/30',
        badge: 'text-teal-300 bg-teal-500/15 border-teal-500/25',
        text: 'text-teal-400',
      };
    }
    if (pnlPct > -8) {
      return {
        bg: 'bg-amber-500/10 hover:bg-amber-500/20',
        border: 'border-amber-500/30',
        badge: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
        text: 'text-amber-400',
      };
    }
    return {
      bg: 'bg-rose-500/20 hover:bg-rose-500/30',
      border: 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.18)]',
      badge: 'text-rose-300 bg-rose-500/20 border-rose-500/40',
      text: 'text-rose-400',
    };
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] transition-all select-none">
      {/* Heatmap Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Peta Sebaran Kinerja Aset (Performance Heatmap)
              </h3>
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                {winRatio}% Positif
              </span>
              <span className="text-[10px] text-slate-400">
                • {assets.length} aset terpantau
              </span>
            </div>
            {!isCollapsed && (
              <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">
                Visualisasi intensitas keuntungan/kerugian untuk mendeteksi aset berkinerja tinggi vs underperforming sekilas.
              </p>
            )}
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center flex-wrap gap-2 self-start md:self-center">
          {/* Scope Toggle: Semua Aset / Floating Saja / Realized Saja */}
          <div className="flex items-center bg-[#0b0e17] p-1 rounded-xl border border-[#1e273d] text-xs">
            <button
              type="button"
              onClick={() => setScope('ALL')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                scope === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua Aset
            </button>
            <button
              type="button"
              onClick={() => setScope('FLOATING')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                scope === 'FLOATING'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Floating Saja
            </button>
            <button
              type="button"
              onClick={() => setScope('REALIZED')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                scope === 'REALIZED'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Realized Saja
            </button>
          </div>

          {!isCollapsed && (
            <>
              {/* Metric View Toggle (% vs $) */}
              <div className="flex items-center bg-[#0b0e17] p-1 rounded-xl border border-[#1e273d] text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayMetric('PERCENT')}
                  title="Tampilkan fokus persentase ROI"
                  className={`p-1.5 rounded-lg transition-all ${
                    displayMetric === 'PERCENT'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMetric('NOMINAL')}
                  title="Tampilkan fokus nominal Rupiah"
                  className={`p-1.5 rounded-lg transition-all ${
                    displayMetric === 'NOMINAL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sorting */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-[#0b0e17] border border-[#1e273d] text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="PNL_DESC">Urut: ROI Tertinggi</option>
                <option value="PNL_ASC">Urut: ROI Terendah</option>
                <option value="CAPITAL">Urut: Modal Terbesar</option>
              </select>

              {/* Perkecil Tampilan (Compact View Toggle) */}
              <button
                type="button"
                onClick={() => setIsCompact(!isCompact)}
                className={`p-1.5 rounded-xl border text-xs transition-all ${
                  isCompact
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-[#0b0e17] border-[#1e273d] text-slate-400 hover:text-white'
                }`}
                title={isCompact ? 'Kembalikan Ukuran Normal' : 'Perkecil Ukuran Kartu (Tampilan Kompak)'}
              >
                {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {/* Sembunyikan / Buka (Collapse/Expand Button) */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b0e17] border border-[#1e273d] text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition-all"
            title={isCollapsed ? 'Tampilkan Heatmap Lengkap' : 'Sembunyikan / Perkecil Heatmap'}
          >
            {isCollapsed ? (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Buka Heatmap</span>
                <ChevronDown className="w-3 h-3 text-blue-400" />
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Sembunyikan</span>
                <ChevronUp className="w-3 h-3 text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsed State Minimal Preview Bar */}
      {isCollapsed && (
        <div className="pt-3 mt-3 border-t border-[#1b2234] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Total Profit Scope:{' '}
              <strong className={totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {totalProfit >= 0 ? '+' : ''}Rp {Math.round(totalProfit).toLocaleString('id-ID')}
              </strong>
            </span>
            {topWinner && (
              <span>
                • Top: <strong className="text-emerald-400">{topWinner.asset}</strong> (+{topWinner.avgPnlPercent.toFixed(1)}%)
              </span>
            )}
            {worstLoser && (
              <span>
                • Underperformer: <strong className="text-rose-400">{worstLoser.asset}</strong> ({worstLoser.avgPnlPercent.toFixed(1)}%)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2"
          >
            Buka tampilan visual penuh
          </button>
        </div>
      )}

      {/* Expanded Body Content */}
      {!isCollapsed && (
        <div className="pt-3 mt-3 border-t border-[#1b2234]">
          {/* Highlights Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3 text-xs">
            {topWinner && (
              <div className="p-3 rounded-xl bg-[#0b0e17] border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Top Performer (Laba Tertinggi)</span>
                  <span className="text-white font-bold text-sm flex items-center gap-1.5 mt-0.5">
                    {topWinner.asset}
                    <span className="text-xs font-semibold text-emerald-400">
                      +{topWinner.avgPnlPercent.toFixed(2)}%
                    </span>
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {formatShortIdr(topWinner.totalLabaBersih)}
                </span>
              </div>
            )}

            {worstLoser && (
              <div className="p-3 rounded-xl bg-[#0b0e17] border border-rose-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Underperformer (Koreksi Terbesar)</span>
                  <span className="text-white font-bold text-sm flex items-center gap-1.5 mt-0.5">
                    {worstLoser.asset}
                    <span className="text-xs font-semibold text-rose-400">
                      {worstLoser.avgPnlPercent.toFixed(2)}%
                    </span>
                  </span>
                </div>
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                  {formatShortIdr(worstLoser.totalLabaBersih)}
                </span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#1e273d] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Total Nilai Laba (Filter Terpilih)</span>
                <span
                  className={`font-bold text-sm block mt-0.5 ${
                    totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalProfit >= 0 ? '+' : ''}Rp {Math.round(totalProfit).toLocaleString('id-ID')}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {scope === 'REALIZED'
                  ? 'Realized Only'
                  : scope === 'FLOATING'
                  ? 'Floating Only'
                  : 'Seluruh Portofolio'}
              </span>
            </div>
          </div>

          {/* Heatmap Grid Matrix (Responsive normal vs compact mode) */}
          <div
            className={
              isCompact
                ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mt-3'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3'
            }
          >
            {assets.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                Belum ada aset terdeteksi. Hubungkan Google Sheet Anda untuk melihat peta sebaran kinerja portofolio.
              </div>
            ) : (
              assets.map(item => {
                const styling = getHeatmapColor(item.avgPnlPercent);
              const capitalShare =
                totalCapitalPool > 0 ? (item.totalNominal / totalCapitalPool) * 100 : 0;
              const isProfitable = item.totalLabaBersih >= 0;

              if (isCompact) {
                // Compact Tile View (Perkecil Tampilan)
                return (
                  <div
                    key={item.asset}
                    onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                    className={`relative overflow-hidden rounded-xl p-2.5 border transition-all duration-200 cursor-pointer ${styling.bg} ${styling.border} hover:scale-[1.02] active:scale-[0.99]`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-sm text-white tracking-tight">
                        {item.asset}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${styling.badge}`}
                      >
                        {isProfitable ? '+' : ''}
                        {item.avgPnlPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs font-bold text-white truncate">
                      {displayMetric === 'PERCENT' ? (
                        <span>{formatShortIdr(item.totalLabaBersih)}</span>
                      ) : (
                        <span>{item.avgPnlPercent.toFixed(2)}% ROI</span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1 truncate">
                      Rp {Math.round(item.totalNominal / 1000000)} Jt ({capitalShare.toFixed(0)}%)
                    </div>
                  </div>
                );
              }

              // Standard Full-Size Card View
              return (
                <div
                  key={item.asset}
                  onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                  className={`relative overflow-hidden rounded-2xl p-4 border transition-all duration-200 cursor-pointer ${styling.bg} ${styling.border} hover:scale-[1.02] active:scale-[0.99]`}
                >
                  {/* Subtle top glow bar */}
                  <div
                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                      isProfitable ? 'from-emerald-400 to-teal-400' : 'from-rose-500 to-amber-500'
                    }`}
                  />

                  {/* Ticker & Status Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-base text-white tracking-tight">
                      {item.asset}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${styling.badge}`}
                    >
                      {isProfitable ? '+' : ''}
                      {item.avgPnlPercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Main Visual Number */}
                  <div className="mt-2.5">
                    <span className="text-[10px] text-slate-400 block">
                      {displayMetric === 'PERCENT' ? 'Laba Bersih Akumulasi' : 'Imbal Hasil ROI'}
                    </span>
                    <div
                      className={`text-lg font-extrabold tracking-tight mt-0.5 ${
                        isProfitable ? 'text-white' : 'text-rose-400'
                      }`}
                    >
                      {displayMetric === 'PERCENT' ? (
                        <span>
                          {isProfitable ? '+' : ''}
                          Rp {Math.round(item.totalLabaBersih).toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span>
                          {isProfitable ? '+' : ''}
                          {item.avgPnlPercent.toFixed(2)}% ROI
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Capital Allocation & Meta */}
                  <div className="pt-2.5 mt-2.5 border-t border-white/10 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 text-[10px]">Alokasi Modal:</span>
                      <span className="font-medium text-slate-200">
                        Rp {Math.round(item.totalNominal).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Porsi Portofolio:</span>
                      <span className="font-semibold text-slate-300">
                        {capitalShare.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[10px] pt-0.5">
                      <span>Transaksi:</span>
                      <span className="font-medium text-slate-300">
                        {item.tradeCount} trade{' '}
                        {item.floatingCount > 0 ? `(${item.floatingCount} aktif)` : '(realized)'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>

          {/* Legend & Color Calibration Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-[#1b2234] text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span>Gradien Kinerja:</span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold">
                  &lt; -8%
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                  -8% s/d 0%
                </span>
                <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25 text-[10px] font-semibold">
                  0% s/d +10%
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                  +10% s/d +20%
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/60 text-[10px] font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  &gt; +20%
                </span>
              </div>
            </div>

            <div className="text-slate-500 text-[10px]">
              *Klik kartu aset untuk memfokuskan analisis
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
