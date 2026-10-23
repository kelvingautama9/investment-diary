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
          bestTradePnlPercent: r.pnlPercent || 0,
          worstTradePnlPercent: r.pnlPercent || 0,
        };
      }

      map[r.asset].totalNominal += r.nominalIdr || 0;
      map[r.asset].totalLabaBersih += r.labaBersih || 0;
      map[r.asset].totalNilaiAset += r.nilaiAset || 0;
      map[r.asset].tradeCount += 1;

      if (r.status === 'Realized') {
        map[r.asset].realizedCount += 1;
      } else {
        map[r.asset].floatingCount += 1;
      }

      if ((r.pnlPercent || 0) > map[r.asset].bestTradePnlPercent) {
        map[r.asset].bestTradePnlPercent = r.pnlPercent || 0;
      }
      if ((r.pnlPercent || 0) < map[r.asset].worstTradePnlPercent) {
        map[r.asset].worstTradePnlPercent = r.pnlPercent || 0;
      }
    });

    const aggregatedList = Object.values(map).map(item => {
      const overallReturn =
        item.totalNominal > 0 ? (item.totalLabaBersih / item.totalNominal) * 100 : 0;
      return {
        ...item,
        avgPnlPercent: overallReturn,
      };
    });

    // Sorting
    aggregatedList.sort((a, b) => {
      if (sortBy === 'PNL_DESC') return b.avgPnlPercent - a.avgPnlPercent;
      if (sortBy === 'PNL_ASC') return a.avgPnlPercent - b.avgPnlPercent;
      if (sortBy === 'CAPITAL') return b.totalNominal - a.totalNominal;
      return 0;
    });

    const pool = aggregatedList.reduce((acc, curr) => acc + curr.totalNominal, 0);

    const winner =
      aggregatedList.length > 0
        ? [...aggregatedList].sort((a, b) => b.avgPnlPercent - a.avgPnlPercent)[0]
        : null;

    const loser =
      aggregatedList.length > 0
        ? [...aggregatedList].sort((a, b) => a.avgPnlPercent - b.avgPnlPercent)[0]
        : null;

    const positiveCount = aggregatedList.filter(a => a.totalLabaBersih >= 0).length;
    const ratio =
      aggregatedList.length > 0 ? Math.round((positiveCount / aggregatedList.length) * 100) : 0;

    return {
      assets: aggregatedList,
      totalCapitalPool: pool,
      topWinner: winner,
      worstLoser: loser,
      winRatio: ratio,
      totalProfit: runningNetProfit,
    };
  }, [records, scope, sortBy]);

  // Color mapper that adapts cleanly to both Light (Vanilla Paper) and Dark themes
  const getHeatmapColor = (pnlPct: number) => {
    if (pnlPct >= 10) {
      return {
        bg: 'bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/15 dark:hover:bg-emerald-950/25',
        border: 'border-emerald-300 dark:border-emerald-800/40',
        badge: 'text-emerald-800 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-500/10 font-bold border-emerald-300 dark:border-emerald-500/20',
        text: 'text-emerald-800 dark:text-emerald-400',
      };
    }
    if (pnlPct > 0) {
      return {
        bg: 'bg-[#ffffff] hover:bg-[#faf7f2] dark:bg-[#101722] dark:hover:bg-[#151f2e]',
        border: 'border-[#e2ded5] dark:border-[#1e2a3a]',
        badge: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 font-bold border-emerald-200 dark:border-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
      };
    }
    if (pnlPct > -8) {
      return {
        bg: 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/10 dark:hover:bg-amber-950/20',
        border: 'border-amber-300 dark:border-amber-800/40',
        badge: 'text-amber-800 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-500/10 font-bold border-amber-300 dark:border-amber-500/20',
        text: 'text-amber-800 dark:text-amber-400',
      };
    }
    return {
      bg: 'bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/30',
      border: 'border-rose-300 dark:border-rose-900/50',
      badge: 'text-rose-800 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-500/10 font-bold border-rose-300 dark:border-rose-500/20',
      text: 'text-rose-800 dark:text-rose-400',
    };
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#ffffff] dark:bg-[#0f131c] border border-[#e5e0d5] dark:border-[#1e2638] select-none shadow-2xs">
      {/* Heatmap Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-[#efebe2] dark:bg-[#141a27] border border-[#ded8cb] dark:border-[#232d42] text-blue-600 dark:text-blue-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <h3 className="font-semibold text-[#1c1917] dark:text-white tracking-tight text-sm">
                Peta Sebaran Kinerja Aset
              </h3>
              <span className="text-[#b8b0a2] dark:text-slate-600">·</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
                {winRatio}% Rasio Positif
              </span>
              <span className="text-[#b8b0a2] dark:text-slate-600">·</span>
              <span className="text-[#6e685f] dark:text-slate-400 font-mono">
                {assets.length} Aset Terkonsolidasi
              </span>
            </div>
            <p className="text-[11px] text-[#6e685f] dark:text-slate-400 mt-0.5">
              Distribusi return modal dan proporsi portofolio terbobot
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Filter */}
          <div className="flex items-center bg-[#efebe2] dark:bg-[#090b10] p-0.5 rounded-lg border border-[#ded8cb] dark:border-[#1a2233] text-xs">
            <button
              type="button"
              onClick={() => setScope('ALL')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                scope === 'ALL'
                  ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                  : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setScope('FLOATING')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                scope === 'FLOATING'
                  ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                  : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Floating
            </button>
            <button
              type="button"
              onClick={() => setScope('REALIZED')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                scope === 'REALIZED'
                  ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                  : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Realized
            </button>
          </div>

          {!isCollapsed && (
            <>
              {/* Metric View Toggle (% vs $) */}
              <div className="flex items-center bg-[#efebe2] dark:bg-[#090b10] p-0.5 rounded-lg border border-[#ded8cb] dark:border-[#1a2233] text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayMetric('PERCENT')}
                  title="Fokus persentase ROI"
                  className={`p-1 rounded-md transition-colors ${
                    displayMetric === 'PERCENT'
                      ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                      : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMetric('NOMINAL')}
                  title="Fokus nominal Rupiah"
                  className={`p-1 rounded-md transition-colors ${
                    displayMetric === 'NOMINAL'
                      ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                      : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sorting */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-[#ffffff] dark:bg-[#0b0e17] border border-[#ded8cb] dark:border-[#1e273d] text-xs text-[#1c1917] dark:text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 shadow-2xs"
              >
                <option value="PNL_DESC">Urut: ROI Tertinggi</option>
                <option value="PNL_ASC">Urut: ROI Terendah</option>
                <option value="CAPITAL">Urut: Modal Terbesar</option>
              </select>

              {/* Perkecil Tampilan (Compact View Toggle) */}
              <button
                type="button"
                onClick={() => setIsCompact(!isCompact)}
                className={`p-1.5 rounded-lg border text-xs transition-all shadow-2xs ${
                  isCompact
                    ? 'bg-blue-600/10 border-blue-600 text-blue-700 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-400'
                    : 'bg-[#ffffff] dark:bg-[#0b0e17] border-[#ded8cb] dark:border-[#1e273d] text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-white'
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#0b0e17] border border-[#ded8cb] dark:border-[#1e273d] text-xs font-semibold text-[#1c1917] dark:text-slate-300 hover:text-black dark:hover:text-white transition-all shadow-2xs"
            title={isCollapsed ? 'Tampilkan Heatmap Lengkap' : 'Sembunyikan / Perkecil Heatmap'}
          >
            {isCollapsed ? (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Buka Heatmap</span>
                <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[#8a8377] dark:text-slate-400" />
                <span>Perkecil</span>
                <ChevronUp className="w-3 h-3 text-[#8a8377] dark:text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Heatmap Content */}
      {!isCollapsed && (
        <div className="mt-4">
          {/* Quick Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {topWinner && (
              <div className="p-3 rounded-lg bg-[#fcfbfa] dark:bg-[#0a0d14] border border-emerald-600/30 dark:border-emerald-800/30 flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block">
                    Return Tertinggi
                  </span>
                  <span className="font-semibold text-sm text-[#1c1917] dark:text-white block mt-0.5">
                    {topWinner.asset}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm block tabular-nums">
                    +{topWinner.avgPnlPercent.toFixed(2)}%
                  </span>
                  <span className="text-[10px] font-mono text-[#6e685f] dark:text-slate-400">
                    +{formatShortIdr(topWinner.totalLabaBersih)}
                  </span>
                </div>
              </div>
            )}

            {worstLoser && (
              <div className="p-3 rounded-lg bg-[#fcfbfa] dark:bg-[#0a0d14] border border-rose-600/30 dark:border-rose-900/30 flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block">
                    Penurunan Terbesar
                  </span>
                  <span className="font-semibold text-sm text-[#1c1917] dark:text-white block mt-0.5">
                    {worstLoser.asset}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-400 text-sm block tabular-nums">
                    {worstLoser.avgPnlPercent.toFixed(2)}%
                  </span>
                  <span className="text-[10px] font-mono text-[#6e685f] dark:text-slate-400">
                    {formatShortIdr(worstLoser.totalLabaBersih)}
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-[#fcfbfa] dark:bg-[#0a0d14] border border-[#e5e0d5] dark:border-[#1e2638] flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block">Total Nilai Laba</span>
                <span
                  className={`font-semibold font-mono text-sm block mt-0.5 tabular-nums ${
                    totalProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {totalProfit >= 0 ? '+' : ''}Rp {Math.round(totalProfit).toLocaleString('id-ID')}
                </span>
              </div>
              <span className="text-[11px] text-[#6e685f] dark:text-slate-400 font-medium">
                {scope === 'REALIZED'
                  ? 'Realized Only'
                  : scope === 'FLOATING'
                  ? 'Floating Only'
                  : 'Seluruh Portofolio'}
              </span>
            </div>
          </div>

          {/* Heatmap Grid Matrix */}
          <div
            className={
              isCompact
                ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mt-3'
                : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-3'
            }
          >
            {assets.length === 0 ? (
              <div className="col-span-full py-8 text-center text-[#8a8377] dark:text-slate-500 text-xs">
                Belum ada aset terdeteksi. Hubungkan Google Sheet Anda untuk melihat peta sebaran kinerja portofolio.
              </div>
            ) : (
              assets.map(item => {
                const styling = getHeatmapColor(item.avgPnlPercent);
                const capitalShare =
                  totalCapitalPool > 0 ? (item.totalNominal / totalCapitalPool) * 100 : 0;
                const isProfitable = item.totalLabaBersih >= 0;

                if (isCompact) {
                  return (
                    <div
                      key={item.asset}
                      onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                      className={`rounded-lg p-2.5 border transition-colors cursor-pointer ${styling.bg} ${styling.border} hover:border-[#b8b0a2] dark:hover:border-slate-500 shadow-2xs`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-[#1c1917] dark:text-white tracking-tight">
                          {item.asset}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-medium px-1 rounded border tabular-nums ${styling.badge}`}
                        >
                          {isProfitable ? '+' : ''}
                          {item.avgPnlPercent.toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-1 text-xs font-mono font-medium text-[#1c1917] dark:text-white truncate tabular-nums">
                        {displayMetric === 'PERCENT' ? (
                          <span>{formatShortIdr(item.totalLabaBersih)}</span>
                        ) : (
                          <span>{item.avgPnlPercent.toFixed(2)}% ROI</span>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-[#6e685f] dark:text-slate-400 mt-1 truncate tabular-nums">
                        Rp {Math.round(item.totalNominal / 1000000)} Jt ({capitalShare.toFixed(0)}%)
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.asset}
                    onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                    className={`rounded-lg p-3 border transition-colors cursor-pointer ${styling.bg} ${styling.border} hover:border-[#b8b0a2] dark:hover:border-slate-500 shadow-2xs`}
                  >
                    {/* Ticker & Status Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#1c1917] dark:text-white tracking-tight">
                        {item.asset}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border tabular-nums ${styling.badge}`}
                      >
                        {isProfitable ? '+' : ''}
                        {item.avgPnlPercent.toFixed(2)}%
                      </span>
                    </div>

                    {/* Main Visual Number */}
                    <div className="mt-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 block font-medium">
                        {displayMetric === 'PERCENT' ? 'Laba Bersih' : 'Imbal Hasil ROI'}
                      </span>
                      <div
                        className={`text-base font-semibold font-mono tracking-tight mt-0.5 tabular-nums ${
                          isProfitable ? 'text-[#1c1917] dark:text-white' : 'text-rose-700 dark:text-rose-400'
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
                    <div className="pt-2 mt-2 border-t border-[#ede8dc] dark:border-[#1e2638] space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                        <span className="text-[#6e685f] dark:text-slate-400 text-[10px]">Alokasi:</span>
                        <span className="font-mono text-[#1c1917] dark:text-slate-200 tabular-nums">
                          Rp {Math.round(item.totalNominal).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#6e685f] dark:text-slate-400 text-[10px]">
                        <span>Porsi:</span>
                        <span className="font-mono text-[#292524] dark:text-slate-300 tabular-nums font-medium">
                          {capitalShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#6e685f] dark:text-slate-400 text-[10px] pt-0.5">
                        <span>Aktivitas:</span>
                        <span className="text-[#1c1917] dark:text-slate-300">
                          {item.tradeCount} trade{' '}
                          {item.floatingCount > 0 ? `(${item.floatingCount} aktif)` : '(realized)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Legend & Calibration Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-[#ede8dc] dark:border-[#1a2233] text-[11px] text-[#6e685f] dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400">Gradien:</span>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                  &lt; -8%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                  -8% s/d 0%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/25">
                  0% s/d +10%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30">
                  +10% s/d +20%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/50">
                  &gt; +20%
                </span>
              </div>
            </div>

            <div className="text-[#8a8377] dark:text-slate-500 text-[10px]">
              Klik kartu aset untuk memfilter daftar transaksi
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
