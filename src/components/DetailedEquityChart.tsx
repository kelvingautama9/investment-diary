'use client';

import React, { useState, useMemo } from 'react';
import type { InvestmentRecord } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/line-charts-9';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, TrendingDown, LineChart as LineIcon, BarChart2 } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Bar,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';

interface DetailedEquityChartProps {
  records: InvestmentRecord[];
}

export const DetailedEquityChart: React.FC<DetailedEquityChartProps> = ({ records }) => {
  const { isDark } = useTheme();
  // Toggle state: 'line' (Kurva Akumulasi) vs 'bar' (Hasil Per Transaksi)
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Chart config
  const chartConfig = {
    equity: {
      label: 'Laba Bersih Kumulatif',
      color: isDark ? '#ffffff' : '#1e3a8a',
    },
    pnl: {
      label: 'Laba/Rugi Transaksi',
      color: '#10b981',
    },
  } satisfies ChartConfig;

  // Format IDR in short Jt / Rb for clean presentation
  const formatShortIdr = (num: number) => {
    const isNeg = num < 0;
    const abs = Math.abs(num);
    const prefix = isNeg ? '-Rp ' : 'Rp ';
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

  const {
    lineChartData,
    barChartData,
    currentBalance,
    totalRealizedGains,
    totalFloatingGains,
    todaysPnL,
    pnlPercentage,
    highValue,
    lowValue,
    changePct,
    activeDate,
    winCount,
    lossCount,
    bestTrade,
  } = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        lineChartData: [],
        barChartData: [],
        currentBalance: 0,
        totalRealizedGains: 0,
        totalFloatingGains: 0,
        todaysPnL: 0,
        pnlPercentage: 0,
        highValue: 0,
        lowValue: 0,
        changePct: 0,
        activeDate: '',
        winCount: 0,
        lossCount: 0,
        bestTrade: null as { asset: string; pnl: number } | null,
      };
    }

    const validRecords = records.filter(r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type));

    const activeFloatingCapital = validRecords
      .filter(r => r.status === 'Floating')
      .reduce((sum, r) => sum + (r.nominalIdr || 0), 0);

    const realizedRecords = validRecords
      .filter(r => r.status === 'Realized')
      .sort(
        (a, b) =>
          new Date(a.exitDate || a.entryDate || 0).getTime() -
          new Date(b.exitDate || b.entryDate || 0).getTime()
      );

    const floatingRecords = validRecords.filter(r => r.status === 'Floating');
    const floatingGain = floatingRecords.reduce((sum, r) => sum + (r.labaBersih || 0), 0);
    const realizedGain = realizedRecords.reduce((sum, r) => sum + (r.labaBersih || 0), 0);

    let runningCumPnL = 0;
    const lineData: Array<{
      date: string;
      rawDate: string;
      value: number;
      fullValue: number;
      pnl: number;
      status: string;
      asset: string;
      isCurrentSnapshot?: boolean;
    }> = [];

    realizedRecords.forEach(r => {
      runningCumPnL += r.labaBersih || 0;
      const formattedDate = r.exitDate
        ? new Date(r.exitDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        : r.entryDate;

      lineData.push({
        date: formattedDate,
        rawDate: r.exitDate || r.entryDate,
        value: Number((runningCumPnL / 1000000).toFixed(2)),
        fullValue: runningCumPnL,
        pnl: r.labaBersih || 0,
        status: r.status,
        asset: r.asset,
      });
    });

    const finalAccumulatedPnL = runningCumPnL + floatingGain;
    lineData.push({
      date: 'Saat Ini',
      rawDate: 'Posisi Terbuka (Floating)',
      value: Number((finalAccumulatedPnL / 1000000).toFixed(2)),
      fullValue: finalAccumulatedPnL,
      pnl: floatingGain,
      status: 'Floating',
      asset: `${floatingRecords.length} Aset Aktif`,
      isCurrentSnapshot: true,
    });

    const barData: Array<{
      name: string;
      asset: string;
      value: number;
      fullValue: number;
      rawDate: string;
      status: string;
      pnlPercent: number;
      nominalIdr: number;
    }> = validRecords.slice(-15).map(r => ({
      name: r.asset,
      asset: r.asset,
      value: Number(((r.labaBersih || 0) / 1000000).toFixed(2)),
      fullValue: r.labaBersih || 0,
      rawDate: r.exitDate || r.entryDate,
      status: r.status,
      pnlPercent: r.pnlPercent || 0,
      nominalIdr: r.nominalIdr || 0,
    }));

    const vals = lineData.map(d => d.fullValue);
    const maxVal = vals.length > 0 ? Math.max(...vals) : 0;
    const minVal = vals.length > 0 ? Math.min(...vals) : 0;
    const lastPnl = realizedRecords.length > 0 ? realizedRecords[realizedRecords.length - 1].labaBersih : 0;

    const netRoi = activeFloatingCapital > 0 ? (finalAccumulatedPnL / activeFloatingCapital) * 100 : 0;

    let wins = 0;
    let losses = 0;
    let maxProfit = 0;
    let maxProfitAsset = '';

    realizedRecords.forEach(r => {
      if ((r.labaBersih || 0) > 0) {
        wins++;
        if ((r.labaBersih || 0) > maxProfit) {
          maxProfit = r.labaBersih || 0;
          maxProfitAsset = r.asset;
        }
      } else {
        losses++;
      }
    });

    return {
      lineChartData: lineData,
      barChartData: barData,
      currentBalance: finalAccumulatedPnL,
      totalRealizedGains: realizedGain,
      totalFloatingGains: floatingGain,
      todaysPnL: lastPnl,
      pnlPercentage: Number(netRoi.toFixed(2)),
      highValue: maxVal,
      lowValue: minVal,
      changePct: Number(netRoi.toFixed(2)),
      activeDate: lineData.length > 1 ? lineData[lineData.length - 2].date : '',
      winCount: wins,
      lossCount: losses,
      bestTrade: maxProfitAsset ? { asset: maxProfitAsset, pnl: maxProfit } : null,
    };
  }, [records]);

  // Max / Min for highlight markers
  const minLineVal = lineChartData.length > 0 ? Math.min(...lineChartData.map(d => d.value)) : 0;
  const maxLineVal = lineChartData.length > 0 ? Math.max(...lineChartData.map(d => d.value)) : 0;

  // Custom Tooltip for Line Chart
  const CustomLineTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = data.fullValue >= 0;
      const isTradePositive = data.pnl >= 0;
      return (
        <div className="bg-[#ffffff] dark:bg-[#0b0e17] border border-[#ded8cb] dark:border-[#1e273d] rounded-xl p-3 shadow-xl dark:shadow-2xl text-xs select-none">
          <div className="text-[#6e685f] dark:text-slate-400 text-[11px] mb-1.5 flex items-center justify-between gap-4">
            <span>{data.isCurrentSnapshot ? 'Titik Terkini' : `Exit: ${data.rawDate || data.date}`}</span>
            <span className="text-blue-700 dark:text-blue-400 font-semibold">{data.asset}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-[#6e685f] dark:text-slate-400">Akumulasi Laba:</span>
              <span className={`text-sm font-bold ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {isPositive ? '+' : ''}Rp {data.fullValue.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] pt-1 border-t border-[#ede8dc] dark:border-[#1e273d]">
              <span className="text-[#6e685f] dark:text-slate-400">
                {data.isCurrentSnapshot ? 'Total Laba Floating:' : 'Laba Realized Transaksi:'}
              </span>
              <span className={`font-semibold ${isTradePositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {isTradePositive ? '+' : ''}Rp {Math.round(data.pnl).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] pt-0.5">
              <span className="text-[#8a8377] dark:text-slate-500">Status:</span>
              <span
                className={`px-1.5 py-0.2 rounded font-semibold text-[9px] ${
                  data.status === 'Realized'
                    ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20'
                }`}
              >
                {data.isCurrentSnapshot ? 'Realized + Floating' : data.status}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = data.fullValue >= 0;
      return (
        <div className="bg-[#ffffff] dark:bg-[#0b0e17] border border-[#ded8cb] dark:border-[#1e273d] rounded-xl p-3 shadow-xl dark:shadow-2xl text-xs select-none min-w-[190px]">
          <div className="text-[#6e685f] dark:text-slate-400 text-[11px] mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[#1c1917] dark:text-white font-bold text-sm">{data.asset}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                data.status === 'Realized'
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                  : 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20'
              }`}
            >
              {data.status}
            </span>
          </div>
          <div className="space-y-1 text-[#44403c] dark:text-slate-300">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#6e685f] dark:text-slate-400">Tanggal:</span>
              <span className="text-[#1c1917] dark:text-slate-200">{data.rawDate}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#6e685f] dark:text-slate-400">Modal:</span>
              <span className="text-[#1c1917] dark:text-slate-200 font-medium">
                Rp {Math.round(data.nominalIdr).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#ede8dc] dark:border-[#1e273d]">
              <span className="text-[#6e685f] dark:text-slate-400">Laba Bersih:</span>
              <span className={`font-bold ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {isPositive ? '+' : ''}Rp {data.fullValue.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#6e685f] dark:text-slate-400">Return (ROI):</span>
              <span className={`font-semibold ${data.pnlPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {data.pnlPercent >= 0 ? '+' : ''}{data.pnlPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full select-none rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#e5e0d5] dark:border-[#1e2638] p-3.5 sm:p-4 shadow-2xs">
      <div className="flex flex-col gap-3">
        {/* Header Balance Banner with Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-[#6e685f] dark:text-slate-400">
              <span className="font-semibold text-[#1c1917] dark:text-slate-200 truncate">
                {chartType === 'line'
                  ? 'Kurva Akumulasi Laba (Realized + Floating)'
                  : 'Distribusi Laba / Rugi Per Transaksi'}
              </span>
              <span className="text-[#b8b0a2] dark:text-slate-600 shrink-0">·</span>
              <span className="text-[#6e685f] dark:text-slate-400 shrink-0 whitespace-nowrap">Database Sheet</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2 mt-1">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums ${
                  currentBalance >= 0 ? 'text-[#1c1917] dark:text-white' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {currentBalance >= 0 ? '+' : ''}Rp {Math.round(currentBalance).toLocaleString('id-ID')}
              </span>
              <div
                className={`flex items-center gap-1 text-xs font-semibold font-mono ${
                  pnlPercentage >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {pnlPercentage >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{pnlPercentage >= 0 ? '+' : ''}{pnlPercentage}% Net ROI</span>
              </div>
            </div>
          </div>

          {/* Segmented Control: Line vs Bar - Compact & Proportionate */}
          <div className="flex items-center shrink-0 self-start sm:self-center bg-[#efebe2] dark:bg-[#090b10] p-0.5 rounded-lg border border-[#ded8cb] dark:border-[#1a2233] h-7 sm:h-8">
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 h-6 sm:h-7 text-[10px] sm:text-[11px] font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                chartType === 'line'
                  ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white font-semibold'
                  : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Tampilkan Kurva Pertumbuhan Akumulasi"
            >
              <LineIcon className="w-3 h-3 shrink-0" />
              <span>Kurva Akumulasi</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 h-6 sm:h-7 text-[10px] sm:text-[11px] font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                chartType === 'bar'
                  ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white font-semibold'
                  : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Tampilkan Diagram Batang Laba/Rugi Tiap Transaksi"
            >
              <BarChart2 className="w-3 h-3 shrink-0" />
              <span>Hasil Transaksi</span>
            </button>
          </div>
        </div>

        {/* Stats Row: Professional Symmetrical Metric Grid */}
        {chartType === 'line' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#6e685f] dark:text-slate-400 px-0.5">
              <span>Transaksi Terakhir:</span>
              <span className={`font-mono font-semibold ${todaysPnL >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {todaysPnL >= 0 ? '+' : ''}Rp {Math.round(todaysPnL).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 p-2 rounded-lg bg-[#faf8f4] dark:bg-[#090c12] border border-[#ede8dc] dark:border-[#1a2233]">
              <div className="min-w-0">
                <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block font-medium truncate">Tertinggi (High)</span>
                <span className="font-mono font-semibold text-xs text-blue-700 dark:text-blue-400 whitespace-nowrap block tabular-nums">
                  {formatShortIdr(highValue)}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block font-medium truncate">Terendah (Low)</span>
                <span className="font-mono font-semibold text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap block tabular-nums">
                  {formatShortIdr(lowValue)}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block font-medium truncate">Realized</span>
                <span className="font-mono font-semibold text-xs text-emerald-700 dark:text-emerald-400 whitespace-nowrap block tabular-nums">
                  {formatShortIdr(totalRealizedGains)}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block font-medium truncate">Floating</span>
                <span className="font-mono font-semibold text-xs text-sky-700 dark:text-sky-400 whitespace-nowrap block tabular-nums">
                  {formatShortIdr(totalFloatingGains)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs p-2 rounded-lg bg-[#faf8f4] dark:bg-[#090c12] border border-[#ede8dc] dark:border-[#1a2233]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-[#44403c] dark:text-slate-300 font-medium text-[11px]">
                  Profit: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{winCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span className="text-[#44403c] dark:text-slate-300 font-medium text-[11px]">
                  Loss: <strong className="text-rose-700 dark:text-rose-400 font-mono">{lossCount}</strong>
                </span>
              </div>
              <span className="text-[#b8b0a2] dark:text-slate-500">•</span>
              <span className="text-[#6e685f] dark:text-slate-400 text-[11px]">
                Win Rate: <strong className="text-[#1c1917] dark:text-white font-mono">{Math.round((winCount / (winCount + lossCount || 1)) * 100)}%</strong>
              </span>
            </div>

            {bestTrade && (
              <div className="text-[11px] text-[#6e685f] dark:text-slate-400 font-mono">
                Top: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">+{formatShortIdr(bestTrade.pnl)} ({bestTrade.asset})</span>
              </div>
            )}
          </div>
        )}

        {/* Chart Canvas Area */}
        <div className="grow mt-1">
          <ChartContainer
            config={chartConfig}
            className="h-60 sm:h-72 w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
          >
            <ComposedChart
              data={(chartType === 'line' ? lineChartData : barChartData) as any}
              margin={{
                top: 15,
                right: 10,
                left: -15,
                bottom: 10,
              }}
            >
              <defs>
                <linearGradient id="areaGradientLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isDark ? '#ffffff' : '#2563eb'} stopOpacity={isDark ? 0.2 : 0.12} />
                  <stop offset="60%" stopColor={isDark ? '#3b82f6' : '#60a5fa'} stopOpacity={0.04} />
                  <stop offset="100%" stopColor={isDark ? '#0a0d14' : '#f6f4ee'} stopOpacity={0} />
                </linearGradient>

                <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="1" fill={isDark ? '#334155' : '#cbd5e1'} fillOpacity={isDark ? 0.35 : 0.45} />
                </pattern>

                <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(37,99,235,0.4)'} />
                </filter>

                <filter id="lineShadow" x="-100%" y="-100%" width="300%" height="300%">
                  <feDropShadow dx="0" dy="4" stdDeviation={isDark ? 10 : 6} floodColor={isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 58, 138, 0.22)'} />
                </filter>
              </defs>

              {/* Background dot grid pattern */}
              <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" style={{ pointerEvents: 'none' }} />

              {/* Dashed Horizontal Cartesian Grid Lines */}
              <CartesianGrid
                strokeDasharray="4 8"
                stroke={isDark ? '#1e293b' : '#e4dfd5'}
                strokeOpacity={0.9}
                horizontal={true}
                vertical={false}
              />

              {chartType === 'bar' ? (
                <ReferenceLine y={0} stroke={isDark ? '#475569' : '#b8b0a2'} strokeWidth={1} />
              ) : (
                activeDate && (
                  <ReferenceLine
                    x={activeDate}
                    stroke={isDark ? '#64748b' : '#a8a29e'}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )
              )}

              <XAxis
                dataKey={chartType === 'line' ? 'date' : 'name'}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#78716c' }}
                tickMargin={8}
                interval={chartType === 'line' ? 'preserveStartEnd' : 0}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                width={45}
                tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#78716c' }}
                tickFormatter={value => {
                  const abs = Math.abs(value);
                  const prefix = value < 0 ? '-' : '';
                  if (abs >= 1) {
                    return `${prefix}${abs.toFixed(1)}Jt`;
                  }
                  return `${prefix}${Math.round(abs * 1000)}Rb`;
                }}
                tickMargin={4}
                domain={chartType === 'line' ? ['dataMin - 0.2', 'dataMax + 0.2'] : ['auto', 'auto']}
              />

              <ChartTooltip
                content={chartType === 'line' ? <CustomLineTooltip /> : <CustomBarTooltip />}
                cursor={{ strokeDasharray: '3 3', stroke: isDark ? '#94a3b8' : '#78716c', strokeOpacity: 0.5 }}
              />

              {/* MODE 1: CURVE LINE */}
              {chartType === 'line' && (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={isDark ? '#ffffff' : '#1e3a8a'}
                  strokeWidth={2.5}
                  filter="url(#lineShadow)"
                  dot={props => {
                    const { cx, cy, payload } = props;
                    const isPeak = payload.value === maxLineVal;
                    const isValley = payload.value === minLineVal;
                    const isCurrent = payload.isCurrentSnapshot;
                    const isHighlight =
                      isPeak ||
                      isValley ||
                      isCurrent ||
                      payload.date === activeDate ||
                      payload.value === lineChartData[0]?.value;

                    if (isHighlight) {
                      return (
                        <circle
                          key={`dot-${payload.date}-${payload.value}`}
                          cx={cx}
                          cy={cy}
                          r={isCurrent ? 7 : 6}
                          fill={isCurrent ? (isDark ? '#38bdf8' : '#2563eb') : '#ffffff'}
                          stroke={isDark ? '#10141f' : '#1e3a8a'}
                          strokeWidth={2.5}
                          filter="url(#dotShadow)"
                        />
                      );
                    }

                    return <g key={`dot-empty-${payload.date}`} />;
                  }}
                  activeDot={{
                    r: 6.5,
                    fill: isDark ? '#ffffff' : '#2563eb',
                    stroke: isDark ? '#3b82f6' : '#ffffff',
                    strokeWidth: 2.5,
                    filter: 'url(#dotShadow)',
                  }}
                />
              )}

              {/* MODE 2: HISTOGRAM BAR CHART */}
              {chartType === 'bar' && (
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={38}>
                  {barChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}-${index}`}
                      fill={entry.fullValue >= 0 ? (isDark ? '#10b981' : '#059669') : (isDark ? '#f43f5e' : '#e11d48')}
                      fillOpacity={0.88}
                    />
                  ))}
                </Bar>
              )}
            </ComposedChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
};
