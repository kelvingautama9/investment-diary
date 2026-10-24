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
  Coins,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  PieChart,
  Search,
  Filter,
  Layers,
} from 'lucide-react';

interface AssetPerformanceHeatmapProps {
  records: InvestmentRecord[];
  onSelectAsset?: (symbol: string) => void;
}

interface AggregatedAsset {
  asset: string;
  totalNominal: number; // Modal aktif yang masih unrealized / floating
  historicalNominal: number; // Total modal historis termasuk realized
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
  // Classification & ranking basis: 'PERCENT' (% ROI) vs 'NOMINAL' (Rp Value)
  const [rankBasis, setRankBasis] = useState<'PERCENT' | 'NOMINAL'>('PERCENT');
  // Outcome filter: 'ALL' (Semua), 'PROFIT' (Untung Saja), 'LOSS' (Rugi Saja)
  const [pnlFilter, setPnlFilter] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  // Sort mode
  const [sortBy, setSortBy] = useState<'ROI_DESC' | 'ROI_ASC' | 'NOMINAL_DESC' | 'NOMINAL_ASC' | 'CAPITAL_DESC' | 'NAME_ASC'>('ROI_DESC');
  // Display metric on cards: 'PERCENT' (PnL %) or 'NOMINAL' (Rp Laba Bersih)
  const [displayMetric, setDisplayMetric] = useState<'PERCENT' | 'NOMINAL'>('PERCENT');
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  // Sembunyikan / Tampilkan (Collapse / Expand)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  // Perkecil tampilan / Mode Kompak
  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Group records by Asset with Scope Filtering (Modal aktif adalah total modal masuk saja yang masih unrealized)
  const { allAssets, filteredAssets, totalCapitalPool, topWinner, worstLoser, winRatio, totalProfit, profitCount, lossCount } = useMemo(() => {
    const validRecords = records.filter(r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type));

    const targetRecords =
      scope === 'FLOATING'
        ? validRecords.filter(r => r.status === 'Floating')
        : scope === 'REALIZED'
        ? validRecords.filter(r => r.status === 'Realized')
        : validRecords;

    if (targetRecords.length === 0) {
      return {
        allAssets: [],
        filteredAssets: [],
        totalCapitalPool: 0,
        topWinner: null,
        worstLoser: null,
        winRatio: 0,
        totalProfit: 0,
        profitCount: 0,
        lossCount: 0,
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
          historicalNominal: 0,
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

      const nominal = r.nominalIdr || (r.entryPrice * r.jumlah) || 0;
      map[r.asset].historicalNominal += nominal;
      map[r.asset].totalLabaBersih += r.labaBersih || 0;
      map[r.asset].totalNilaiAset += r.nilaiAset || 0;
      map[r.asset].tradeCount += 1;

      if (r.status === 'Realized') {
        map[r.asset].realizedCount += 1;
        // In realized-only view, count the realized capital
        if (scope === 'REALIZED') {
          map[r.asset].totalNominal += nominal;
        }
      } else {
        // Floating / Unrealized trade - inilah modal masuk aktif!
        map[r.asset].floatingCount += 1;
        if (scope !== 'REALIZED') {
          map[r.asset].totalNominal += nominal;
        }
      }

      if ((r.pnlPercent || 0) > map[r.asset].bestTradePnlPercent) {
        map[r.asset].bestTradePnlPercent = r.pnlPercent || 0;
      }
      if ((r.pnlPercent || 0) < map[r.asset].worstTradePnlPercent) {
        map[r.asset].worstTradePnlPercent = r.pnlPercent || 0;
      }
    });

    const aggregatedList: AggregatedAsset[] = Object.values(map).map(item => {
      const baseCost = item.totalNominal > 0 ? item.totalNominal : item.historicalNominal;
      const overallReturn =
        baseCost > 0 ? (item.totalLabaBersih / baseCost) * 100 : 0;
      return {
        ...item,
        avgPnlPercent: overallReturn,
      };
    });

    // Total modal aktif adalah total modal masuk saja yang masih unrealized
    const pool = aggregatedList.reduce((acc, curr) => acc + curr.totalNominal, 0);

    // Identify Top Winner & Worst Loser based on rankBasis (% ROI vs Nominal Rp)
    let winner: AggregatedAsset | null = null;
    let loser: AggregatedAsset | null = null;

    if (aggregatedList.length > 0) {
      if (rankBasis === 'PERCENT') {
        // Based on % ROI
        const sortedByRoi = [...aggregatedList].sort((a, b) => b.avgPnlPercent - a.avgPnlPercent);
        winner = sortedByRoi[0];
        loser = sortedByRoi[sortedByRoi.length - 1];
      } else {
        // Based on Nominal Laba/Rugi Bersih (Rp)
        const sortedByNominal = [...aggregatedList].sort((a, b) => b.totalLabaBersih - a.totalLabaBersih);
        winner = sortedByNominal[0];
        loser = sortedByNominal[sortedByNominal.length - 1];
      }
    }

    const profits = aggregatedList.filter(a => a.totalLabaBersih >= 0);
    const losses = aggregatedList.filter(a => a.totalLabaBersih < 0);
    const ratio = aggregatedList.length > 0 ? Math.round((profits.length / aggregatedList.length) * 100) : 0;

    // Apply Outcome Filter (Semua / Untung Saja / Rugi Saja)
    let filtered = [...aggregatedList];
    if (pnlFilter === 'PROFIT') {
      filtered = filtered.filter(a => a.totalLabaBersih >= 0);
    } else if (pnlFilter === 'LOSS') {
      filtered = filtered.filter(a => a.totalLabaBersih < 0);
    }

    // Apply Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a => a.asset.toLowerCase().includes(q));
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'ROI_DESC') return b.avgPnlPercent - a.avgPnlPercent;
      if (sortBy === 'ROI_ASC') return a.avgPnlPercent - b.avgPnlPercent;
      if (sortBy === 'NOMINAL_DESC') return b.totalLabaBersih - a.totalLabaBersih;
      if (sortBy === 'NOMINAL_ASC') return a.totalLabaBersih - b.totalLabaBersih;
      if (sortBy === 'CAPITAL_DESC') return b.totalNominal - a.totalNominal;
      if (sortBy === 'NAME_ASC') return a.asset.localeCompare(b.asset);
      return 0;
    });

    return {
      allAssets: aggregatedList,
      filteredAssets: filtered,
      totalCapitalPool: pool,
      topWinner: winner,
      worstLoser: loser,
      winRatio: ratio,
      totalProfit: runningNetProfit,
      profitCount: profits.length,
      lossCount: losses.length,
    };
  }, [records, scope, rankBasis, pnlFilter, searchQuery, sortBy]);

  // Color mapper tailored for authentic vanilla paper matte (light) and obsidian (dark)
  const getHeatmapColor = (pnlPct: number, labaBersih: number) => {
    const isProfitable = labaBersih >= 0;
    if (isProfitable) {
      if (pnlPct >= 15) {
        return {
          bg: 'bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30',
          border: 'border-emerald-300/80 dark:border-emerald-800/50',
          badge: 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-600/30',
          text: 'text-emerald-800 dark:text-emerald-300',
          bar: 'bg-emerald-600 dark:bg-emerald-500',
        };
      }
      return {
        bg: 'bg-[#ffffff] hover:bg-[#faf7f0] dark:bg-[#0f1420] dark:hover:bg-[#141b2a]',
        border: 'border-[#ded8cb] dark:border-[#1e2638]',
        badge: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        bar: 'bg-emerald-600 dark:bg-emerald-500',
      };
    }

    if (pnlPct > -10) {
      return {
        bg: 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/15 dark:hover:bg-amber-950/25',
        border: 'border-amber-300/80 dark:border-amber-800/40',
        badge: 'text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-500/15 border-amber-300 dark:border-amber-600/30',
        text: 'text-amber-800 dark:text-amber-300',
        bar: 'bg-amber-600 dark:bg-amber-500',
      };
    }

    return {
      bg: 'bg-rose-50/70 hover:bg-rose-100/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/30',
      border: 'border-rose-300/80 dark:border-rose-900/50',
      badge: 'text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-500/15 border-rose-300 dark:border-rose-600/30',
      text: 'text-rose-800 dark:text-rose-300',
      bar: 'bg-rose-600 dark:bg-rose-500',
    };
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#e5e0d5] dark:border-[#1e2638] select-none shadow-2xs space-y-4">
      {/* 1. Header Toolbar: Metrics and Scope Controls (Double title & logo box removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#ede8dc] dark:border-[#1a2233]">
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono text-xs bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 rounded border border-emerald-500/20">
            {winRatio}% Win Rate ({profitCount}/{allAssets.length} Aset)
          </span>
          <span className="text-[#b8b0a2] dark:text-slate-600">·</span>
          <span className="text-[#1c1917] dark:text-white font-mono text-xs font-semibold">
            {scope === 'REALIZED' ? 'Total Modal Realized' : 'Total Modal Masuk (Aktif)'}: Rp {Math.round(totalCapitalPool).toLocaleString('id-ID')}
          </span>
          <span className="text-[#b8b0a2] dark:text-slate-600">·</span>
          <span className="text-[#6e685f] dark:text-slate-400 font-mono text-[11px]">
            {scope === 'REALIZED'
              ? `${allAssets.filter(a => a.realizedCount > 0).length} Aset Selesai`
              : `${allAssets.filter(a => a.floatingCount > 0).length} Aset Aktif`}
          </span>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Filter */}
          <div className="flex items-center bg-[#efebe2] dark:bg-[#07090e] p-0.5 rounded-lg border border-[#ded8cb] dark:border-[#1e2638] text-xs">
            <button
              type="button"
              onClick={() => setScope('ALL')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors text-[11px] ${
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
              className={`px-2.5 py-1 font-medium rounded-md transition-colors text-[11px] ${
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
              className={`px-2.5 py-1 font-medium rounded-md transition-colors text-[11px] ${
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
              {/* Compact Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsCompact(!isCompact)}
                className={`p-1.5 rounded-lg border text-xs transition-all shadow-2xs ${
                  isCompact
                    ? 'bg-blue-600/10 border-blue-600 text-blue-700 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-400'
                    : 'bg-[#ffffff] dark:bg-[#07090e] border-[#ded8cb] dark:border-[#1e2638] text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-white'
                }`}
                title={isCompact ? 'Tampilkan Mode Detail' : 'Perkecil Ukuran Grid (Mode Kompak)'}
              >
                {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {/* Sembunyikan / Buka (Collapse/Expand Button) */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ffffff] dark:bg-[#07090e] border border-[#ded8cb] dark:border-[#1e2638] text-xs font-semibold text-[#1c1917] dark:text-slate-300 hover:text-black dark:hover:text-white transition-all shadow-2xs"
            title={isCollapsed ? 'Buka Peta Aset' : 'Perkecil / Sembunyikan Konten'}
          >
            {isCollapsed ? (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[11px]">Buka Heatmap</span>
                <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[#8a8377] dark:text-slate-400" />
                <span className="text-[11px]">Perkecil</span>
                <ChevronUp className="w-3 h-3 text-[#8a8377] dark:text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* 2. Top Performer & Underperformer Classification Section with 3 Distinct Aspects */}
          <div className="space-y-2.5">
            {/* Classification Basis Selector Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#f9f7f2] dark:bg-[#07090e] p-2 rounded-lg border border-[#ded8cb] dark:border-[#1e2638]">
              <div className="flex items-center gap-1.5 text-xs text-[#6e685f] dark:text-slate-400">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8a8377] dark:text-slate-400">
                  Klasifikasi Return Tertinggi &amp; Penurunan Terbesar:
                </span>
              </div>

              {/* Small Filtering Buttons to toggle between % ROI and Rp Nominal Value */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#6e685f] dark:text-slate-400 font-medium mr-1 hidden sm:inline">
                  Dasar Perhitungan:
                </span>
                <div className="flex items-center bg-[#efebe2] dark:bg-[#121622] p-0.5 rounded-md border border-[#ded8cb] dark:border-[#1e2638]">
                  <button
                    type="button"
                    onClick={() => setRankBasis('PERCENT')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      rankBasis === 'PERCENT'
                        ? 'bg-[#ffffff] text-blue-700 dark:text-blue-400 shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#1a2233]'
                        : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Klasifikasikan pemenang &amp; penurunan berdasarkan persentase imbal hasil ROI"
                  >
                    <Percent className="w-3 h-3" />
                    <span>Persentase (% ROI)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRankBasis('NOMINAL')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      rankBasis === 'NOMINAL'
                        ? 'bg-[#ffffff] text-blue-700 dark:text-blue-400 shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#1a2233]'
                        : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Klasifikasikan pemenang &amp; penurunan berdasarkan nominal uang keuntungan/kerugian (Rp)"
                  >
                    <Coins className="w-3 h-3" />
                    <span>Nominal Uang (Rp)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3 Executive High-Clarity Cards (Top Performer, Underperformer, Portofolio Overview) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Return Tertinggi (Top Performer) */}
              <div className="p-3.5 rounded-xl bg-[#ffffff] dark:bg-[#07090e] border-2 border-emerald-500/40 dark:border-emerald-500/30 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-500/15">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-400">
                        Return Tertinggi
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                      Basis: {rankBasis === 'PERCENT' ? '% ROI' : 'Nominal Rp'}
                    </span>
                  </div>

                  {topWinner ? (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-[#1c1917] dark:text-white font-mono tracking-tight">
                          {topWinner.asset}
                        </span>
                        <span className="text-[11px] font-mono text-[#6e685f] dark:text-slate-400">
                          {topWinner.tradeCount} trade ({topWinner.floatingCount} aktif)
                        </span>
                      </div>

                      {/* 3 Distinct Aspect Breakdown */}
                      <div className="space-y-2 pt-1 border-t border-[#ede8dc] dark:border-[#1a2233] text-xs">
                        {/* Aspek 1: Persenan Capital yang diinvestasikan ke aset itu (% ROI) */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#6e685f] dark:text-slate-400">
                            1. Imbal Hasil (% ROI Aset):
                          </span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
                            +{topWinner.avgPnlPercent.toFixed(2)}%
                          </span>
                        </div>

                        {/* Aspek 2: Nominal Uang (Laba Bersih Bersih dalam Rp) */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#6e685f] dark:text-slate-400">
                            2. Nominal Laba Bersih:
                          </span>
                          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            +Rp {Math.round(topWinner.totalLabaBersih).toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Aspek 3: Persentase dari Total Keseluruhan Modal */}
                        <div className="pt-1.5 border-t border-[#f0ece2] dark:border-[#141b29]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#6e685f] dark:text-slate-400">
                              3. Porsi Modal Portofolio:
                            </span>
                            <span className="font-mono font-semibold text-[#1c1917] dark:text-white tabular-nums">
                              {totalCapitalPool > 0
                                ? ((topWinner.totalNominal / totalCapitalPool) * 100).toFixed(2)
                                : '0.00'}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#8a8377] dark:text-slate-500 font-mono mt-0.5">
                            <span>{topWinner.totalNominal > 0 ? 'Modal Aktif:' : 'Modal Historis:'}</span>
                            <span>Rp {Math.round(topWinner.totalNominal > 0 ? topWinner.totalNominal : topWinner.historicalNominal).toLocaleString('id-ID')}</span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full bg-[#ede8dc] dark:bg-[#1a2233] h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  totalCapitalPool > 0
                                    ? (topWinner.totalNominal / totalCapitalPool) * 100
                                    : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-[#8a8377] dark:text-slate-500">
                      Tidak ada data aset terdeteksi
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Penurunan Terbesar (Underperformer) */}
              <div className="p-3.5 rounded-xl bg-[#ffffff] dark:bg-[#07090e] border-2 border-rose-500/40 dark:border-rose-500/30 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-rose-500/15">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400">
                        <TrendingDown className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-rose-800 dark:text-rose-400">
                        Penurunan Terbesar
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-500/20">
                      Basis: {rankBasis === 'PERCENT' ? '% ROI' : 'Nominal Rp'}
                    </span>
                  </div>

                  {worstLoser ? (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-[#1c1917] dark:text-white font-mono tracking-tight">
                          {worstLoser.asset}
                        </span>
                        <span className="text-[11px] font-mono text-[#6e685f] dark:text-slate-400">
                          {worstLoser.tradeCount} trade ({worstLoser.floatingCount} aktif)
                        </span>
                      </div>

                      {/* 3 Distinct Aspect Breakdown */}
                      <div className="space-y-2 pt-1 border-t border-[#ede8dc] dark:border-[#1a2233] text-xs">
                        {/* Aspek 1: Persenan Capital yang diinvestasikan ke aset itu (% ROI) */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#6e685f] dark:text-slate-400">
                            1. Imbal Hasil (% ROI Aset):
                          </span>
                          <span
                            className={`font-mono font-bold text-sm tabular-nums ${
                              worstLoser.avgPnlPercent >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {worstLoser.avgPnlPercent >= 0 ? '+' : ''}
                            {worstLoser.avgPnlPercent.toFixed(2)}%
                          </span>
                        </div>

                        {/* Aspek 2: Nominal Uang (Laba Bersih Bersih dalam Rp) */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#6e685f] dark:text-slate-400">
                            2. Nominal Laba/Rugi:
                          </span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              worstLoser.totalLabaBersih >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {worstLoser.totalLabaBersih >= 0 ? '+' : ''}Rp{' '}
                            {Math.round(worstLoser.totalLabaBersih).toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Aspek 3: Persentase dari Total Keseluruhan Modal */}
                        <div className="pt-1.5 border-t border-[#f0ece2] dark:border-[#141b29]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#6e685f] dark:text-slate-400">
                              3. Porsi Modal Portofolio:
                            </span>
                            <span className="font-mono font-semibold text-[#1c1917] dark:text-white tabular-nums">
                              {totalCapitalPool > 0
                                ? ((worstLoser.totalNominal / totalCapitalPool) * 100).toFixed(2)
                                : '0.00'}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#8a8377] dark:text-slate-500 font-mono mt-0.5">
                            <span>{worstLoser.totalNominal > 0 ? 'Modal Aktif:' : 'Modal Historis:'}</span>
                            <span>Rp {Math.round(worstLoser.totalNominal > 0 ? worstLoser.totalNominal : worstLoser.historicalNominal).toLocaleString('id-ID')}</span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div className="w-full bg-[#ede8dc] dark:bg-[#1a2233] h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-rose-600 dark:bg-rose-500 h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  totalCapitalPool > 0
                                    ? (worstLoser.totalNominal / totalCapitalPool) * 100
                                    : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-[#8a8377] dark:text-slate-500">
                      Tidak ada data aset terdeteksi
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Portofolio Aggregation Overview */}
              <div className="p-3.5 rounded-xl bg-[#ffffff] dark:bg-[#07090e] border border-[#e5e0d5] dark:border-[#1e2638] flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#ede8dc] dark:border-[#1a2233]">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                        <PieChart className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#1c1917] dark:text-slate-300">
                        Total Akumulasi Portofolio
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#6e685f] dark:text-slate-400">
                      {scope === 'REALIZED' ? 'Realized' : scope === 'FLOATING' ? 'Floating' : 'Semua Posisi'}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2.5">
                    <div>
                      <span className="text-[10px] uppercase text-[#6e685f] dark:text-slate-400 font-medium block">
                        Total Laba / Rugi Bersih
                      </span>
                      <div
                        className={`text-xl font-bold font-mono tracking-tight mt-0.5 tabular-nums ${
                          totalProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {totalProfit >= 0 ? '+' : ''}Rp {Math.round(totalProfit).toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-[#ede8dc] dark:border-[#1a2233] text-xs">
                      {/* Total Modal Masuk */}
                      <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                        <span className="text-[11px] text-[#6e685f] dark:text-slate-400">
                          {scope === 'REALIZED' ? 'Total Modal Realized:' : 'Total Modal Masuk (Aktif):'}
                        </span>
                        <span className="font-mono font-semibold text-[#1c1917] dark:text-white tabular-nums">
                          Rp {Math.round(totalCapitalPool).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Win Rate */}
                      <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                        <span className="text-[11px] text-[#6e685f] dark:text-slate-400">Win Rate:</span>
                        <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {winRatio}%
                          </span>
                          <span className="text-[10px] text-[#8a8377] dark:text-slate-400 whitespace-nowrap">
                            ({profitCount} Menang, {lossCount} Kalah)
                          </span>
                        </div>
                      </div>

                      {/* Total Posisi & Progress Bar */}
                      <div className="pt-1.5 border-t border-[#f0ece2] dark:border-[#141b29]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#6e685f] dark:text-slate-400">Total Posisi:</span>
                          <span className="font-mono font-semibold text-[#1c1917] dark:text-white tabular-nums">
                            {records.length} Transaksi
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#8a8377] dark:text-slate-500 font-mono mt-0.5">
                          <span>Distribusi Aset:</span>
                          <span>{allAssets.length} Aset Terkonsolidasi</span>
                        </div>
                        {/* Mini Progress Bar for Win Rate */}
                        <div className="w-full bg-[#ede8dc] dark:bg-[#1a2233] h-1.5 rounded-full overflow-hidden mt-1 flex">
                          <div
                            className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all"
                            style={{ width: `${winRatio}%` }}
                            title={`Win Rate: ${winRatio}%`}
                          />
                          <div
                            className="bg-rose-500 dark:bg-rose-600 h-full transition-all"
                            style={{ width: `${100 - winRatio}%` }}
                            title={`Loss: ${100 - winRatio}%`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Secondary Filter & Sorting Strip for Matrix Cards */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[#ede8dc] dark:border-[#1a2233]">
            {/* Quick Filter Chips: Semua / Untung Saja / Rugi Saja */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-[#6e685f] dark:text-slate-400 font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#8a8377] dark:text-slate-400" />
                <span>Filter Kartu:</span>
              </span>

              <button
                type="button"
                onClick={() => setPnlFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  pnlFilter === 'ALL'
                    ? 'bg-[#1c1917] text-white dark:bg-white dark:text-[#1c1917] shadow-xs'
                    : 'bg-[#efebe2] dark:bg-[#121622] text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200 border border-[#ded8cb] dark:border-[#1e2638]'
                }`}
              >
                Semua ({allAssets.length})
              </button>

              <button
                type="button"
                onClick={() => setPnlFilter('PROFIT')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  pnlFilter === 'PROFIT'
                    ? 'bg-emerald-700 text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                    : 'bg-[#efebe2] dark:bg-[#121622] text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/20 border border-emerald-300/60 dark:border-emerald-800/40'
                }`}
              >
                Untung / Profit ({profitCount})
              </button>

              <button
                type="button"
                onClick={() => setPnlFilter('LOSS')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  pnlFilter === 'LOSS'
                    ? 'bg-rose-700 text-white dark:bg-rose-600 dark:text-white shadow-xs'
                    : 'bg-[#efebe2] dark:bg-[#121622] text-rose-800 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-950/20 border border-rose-300/60 dark:border-rose-800/40'
                }`}
              >
                Rugi / Loss ({lossCount})
              </button>
            </div>

            {/* Sorting & Search */}
            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3 h-3 text-[#8a8377] dark:text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari aset..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2.5 py-1 text-xs rounded-lg bg-[#ffffff] dark:bg-[#07090e] border border-[#ded8cb] dark:border-[#1e2638] text-[#1c1917] dark:text-white placeholder:text-[#8a8377] dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 w-32 sm:w-36"
                />
              </div>

              {/* Metric Card Focus Toggle (% vs Rp) */}
              <div className="flex items-center bg-[#efebe2] dark:bg-[#07090e] p-0.5 rounded-lg border border-[#ded8cb] dark:border-[#1e2638] text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayMetric('PERCENT')}
                  title="Tampilan Fokus ROI (%)"
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
                  title="Tampilan Fokus Nominal (Rp)"
                  className={`p-1 rounded-md transition-colors ${
                    displayMetric === 'NOMINAL'
                      ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                      : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-[#ffffff] dark:bg-[#07090e] border border-[#ded8cb] dark:border-[#1e2638] text-xs text-[#1c1917] dark:text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 shadow-2xs font-medium"
              >
                <option value="ROI_DESC">Urut: ROI Tertinggi (%)</option>
                <option value="ROI_ASC">Urut: ROI Terendah (%)</option>
                <option value="NOMINAL_DESC">Urut: Laba Terbesar (Rp)</option>
                <option value="NOMINAL_ASC">Urut: Rugi Terbesar (Rp)</option>
                <option value="CAPITAL_DESC">Urut: Modal Terbesar</option>
                <option value="NAME_ASC">Urut: Nama Aset (A-Z)</option>
              </select>
            </div>
          </div>

          {/* 4. Heatmap Grid Matrix with Clear 3-Aspect Visual Layout */}
          <div
            className={
              isCompact
                ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'
                : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5'
            }
          >
            {filteredAssets.length === 0 ? (
              <div className="col-span-full py-10 text-center text-[#8a8377] dark:text-slate-500 text-xs bg-[#faf8f4] dark:bg-[#080b12] rounded-xl border border-dashed border-[#ded8cb] dark:border-[#1e2638]">
                Tidak ada data aset yang cocok dengan filter atau kata kunci pencarian.
              </div>
            ) : (
              filteredAssets.map(item => {
                const styling = getHeatmapColor(item.avgPnlPercent, item.totalLabaBersih);
                const capitalShare =
                  totalCapitalPool > 0 ? (item.totalNominal / totalCapitalPool) * 100 : 0;
                const isProfitable = item.totalLabaBersih >= 0;

                if (isCompact) {
                  return (
                    <div
                      key={item.asset}
                      onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                      className={`rounded-lg p-2 border transition-all cursor-pointer ${styling.bg} ${styling.border} hover:border-[#b8b0a2] dark:hover:border-slate-500 shadow-2xs`}
                      title={`Klik untuk melihat transaksi ${item.asset}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-[#1c1917] dark:text-white tracking-tight">
                          {item.asset}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold px-1 rounded border tabular-nums ${styling.badge}`}
                        >
                          {isProfitable ? '+' : ''}
                          {item.avgPnlPercent.toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-1 text-xs font-mono font-medium text-[#1c1917] dark:text-white truncate tabular-nums">
                        {displayMetric === 'PERCENT' ? (
                          <span className={isProfitable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                            {isProfitable ? '+' : ''}Rp {Math.round(item.totalLabaBersih / 1000).toLocaleString('id-ID')} Rb
                          </span>
                        ) : (
                          <span>{item.avgPnlPercent.toFixed(2)}% ROI</span>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-[#6e685f] dark:text-slate-400 mt-1 truncate tabular-nums flex items-center justify-between">
                        <span>{capitalShare.toFixed(1)}% modal</span>
                        <span>Rp {Math.round(item.totalNominal / 1000000)} Jt</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.asset}
                    onClick={() => onSelectAsset && onSelectAsset(item.asset)}
                    className={`rounded-xl p-3 border transition-all cursor-pointer ${styling.bg} ${styling.border} hover:border-[#a8a092] dark:hover:border-slate-500 shadow-2xs flex flex-col justify-between`}
                    title={`Klik untuk melihat riwayat transaksi ${item.asset}`}
                  >
                    <div>
                      {/* Ticker & Status Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#1c1917] dark:text-white tracking-tight font-mono">
                            {item.asset}
                          </span>
                          <span className="text-[10px] text-[#8a8377] dark:text-slate-500 font-mono">
                            ({item.tradeCount} trade)
                          </span>
                        </div>

                        {/* Aspek 1: Imbal Hasil ROI Aset */}
                        <span
                          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border tabular-nums ${styling.badge}`}
                        >
                          {isProfitable ? '+' : ''}
                          {item.avgPnlPercent.toFixed(2)}% ROI
                        </span>
                      </div>

                      {/* Aspek 2: Nominal Laba Bersih */}
                      <div className="mt-2.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 block font-semibold">
                          {isProfitable ? 'Laba Bersih' : 'Rugi Bersih'}
                        </span>
                        <div
                          className={`text-base font-bold font-mono tracking-tight mt-0.5 tabular-nums ${
                            isProfitable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {isProfitable ? '+' : ''}Rp {Math.round(item.totalLabaBersih).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    {/* Aspek 3: Modal Terinvestasi & % Porsi Portofolio */}
                    <div className="pt-2.5 mt-2.5 border-t border-[#ede8dc] dark:border-[#1e2638] space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-[#292524] dark:text-slate-300">
                        <span className="text-[#6e685f] dark:text-slate-400 text-[10px]">
                          {item.totalNominal > 0 ? 'Modal Aktif:' : 'Modal Historis:'}
                        </span>
                        <span className="font-mono text-[#1c1917] dark:text-slate-200 tabular-nums font-medium">
                          Rp {Math.round(item.totalNominal > 0 ? item.totalNominal : item.historicalNominal).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[#6e685f] dark:text-slate-400 text-[10px]">
                        <span>Porsi dari Modal Aktif:</span>
                        <span className="font-mono text-[#1c1917] dark:text-white tabular-nums font-semibold">
                          {capitalShare.toFixed(2)}%
                        </span>
                      </div>

                      {/* Mini Progress Bar for Portfolio Share */}
                      <div className="w-full bg-[#e8e3d8] dark:bg-[#1a2233] h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`${styling.bar} h-full rounded-full transition-all`}
                          style={{ width: `${Math.min(100, capitalShare)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#8a8377] dark:text-slate-500 pt-0.5">
                        <span>Status Posisi:</span>
                        <span className="font-mono">
                          {item.floatingCount > 0 ? `${item.floatingCount} aktif (floating)` : '100% realized'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 5. Calibration Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#ede8dc] dark:border-[#1a2233] text-[11px] text-[#6e685f] dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e685f] dark:text-slate-400">
                Skala Heatmap:
              </span>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-800 dark:text-rose-400 border border-rose-500/30 font-medium">
                  &lt; -10% (Penurunan)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 font-medium">
                  -10% s/d 0%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                  0% s/d +15%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-bold">
                  &gt; +15% (Superior)
                </span>
              </div>
            </div>

            <div className="text-[#8a8377] dark:text-slate-500 text-[10px] font-medium">
              Tip: Klik pada sembarang kartu aset untuk langsung membuka riwayat transaksinya di Buku Transaksi.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
