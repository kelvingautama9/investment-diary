'use client';

import React, { useState, useMemo } from 'react';
import type { InvestmentRecord } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/line-charts-9';
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
  // Toggle state: 'line' (Kurva Akumulasi) vs 'bar' (Hasil Per Transaksi)
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Chart config
  const chartConfig = {
    equity: {
      label: 'Laba Bersih Kumulatif',
      color: '#ffffff',
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

  // Build data based on Rekomendasi Utama:
  // 1. Line Chart: Kronologi masa lalu diisi transaksi Realized (by exitDate) + 1 titik terakhir "Saat Ini (Floating)"
  // 2. Bar Chart: Histogram performa individual per aset (Hijau = Profit, Merah = Loss)
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

    // Modal Floating Aktif untuk basis perhitungan ROI (Strictly dropping transport/expense records)
    const validRecords = records.filter(r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type));

    const activeFloatingCapital = validRecords
      .filter(r => r.status === 'Floating')
      .reduce((sum, r) => sum + (r.nominalIdr || 0), 0);

    // 1. Data Realized diurutkan berdasarkan exitDate
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

    // Susun titik-titik untuk Line Chart
    let runningCumPnL = 0;
    const lineData: Array<{
      date: string;
      rawDate: string;
      value: number; // in Millions IDR
      fullValue: number;
      pnl: number;
      asset: string;
      status: 'Realized' | 'Floating';
      isCurrentSnapshot?: boolean;
    }> = [];

    realizedRecords.forEach(r => {
      runningCumPnL += r.labaBersih || 0;
      const exitD = r.exitDate ? new Date(r.exitDate) : new Date(r.entryDate);
      const dateLabel = isNaN(exitD.getTime())
        ? r.exitDate || r.entryDate
        : exitD.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });

      lineData.push({
        date: dateLabel,
        rawDate: r.exitDate || r.entryDate,
        value: Number((runningCumPnL / 1000000).toFixed(2)),
        fullValue: Math.round(runningCumPnL),
        pnl: r.labaBersih || 0,
        asset: r.asset,
        status: 'Realized',
      });
    });

    // Titik Terakhir Rekomendasi Utama: "Saat Ini (Floating)"
    if (floatingRecords.length > 0) {
      runningCumPnL += floatingGain;
      lineData.push({
        date: 'Saat Ini',
        rawDate: 'Posisi Floating Aktif',
        value: Number((runningCumPnL / 1000000).toFixed(2)),
        fullValue: Math.round(runningCumPnL),
        pnl: floatingGain,
        asset: `${floatingRecords.length} Aset Aktif`,
        status: 'Floating',
        isCurrentSnapshot: true,
      });
    }

    // 2. Susun data untuk Bar Chart (Histogram Laba/Rugi per Aset)
    const sortedAll = [...validRecords].sort((a, b) => {
      const dateA = new Date(a.exitDate || a.entryDate || 0).getTime();
      const dateB = new Date(b.exitDate || b.entryDate || 0).getTime();
      return dateA - dateB;
    });

    let wins = 0;
    let losses = 0;
    let maxProfit = -Infinity;
    let maxProfitAsset = '';

    const barData: Array<{
      name: string;
      asset: string;
      date: string;
      rawDate: string;
      value: number;
      fullValue: number;
      pnl: number;
      status: 'Realized' | 'Floating';
      nominalIdr: number;
      pnlPercent: number;
    }> = [];

    sortedAll.forEach(r => {
      const pnl = r.labaBersih || 0;
      if (pnl >= 0) wins++;
      else losses++;

      if (pnl > maxProfit) {
        maxProfit = pnl;
        maxProfitAsset = r.asset;
      }

      const dateStr = r.exitDate || r.entryDate;
      const d = new Date(dateStr);
      const dateLabel = isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });

      barData.push({
        name: `${r.asset} (${dateLabel})`,
        asset: r.asset,
        date: dateLabel,
        rawDate: dateStr,
        value: Number((pnl / 1000000).toFixed(2)),
        fullValue: Math.round(pnl),
        pnl,
        status: r.status,
        nominalIdr: r.nominalIdr || 0,
        pnlPercent: r.pnlPercent || 0,
      });
    });

    const fullValues = lineData.map(d => d.fullValue);
    const currBal = lineData.length > 0 ? lineData[lineData.length - 1].fullValue : 0;
    const pnlPct = activeFloatingCapital > 0 ? (currBal / activeFloatingCapital) * 100 : 0;

    const highVal = lineData.length > 0 ? Math.max(...fullValues) : 0;
    const lowVal = lineData.length > 0 ? Math.min(...fullValues) : 0;

    // Transaksi terakhir dicatat dari records yang paling baru
    const lastRecord = sortedAll[sortedAll.length - 1];
    const lastPnL = lastRecord ? lastRecord.labaBersih : 0;
    const activeRefDate =
      lineData.length > 2 ? lineData[Math.floor(lineData.length / 2)].date : lineData[0]?.date || '';

    return {
      lineChartData: lineData,
      barChartData: barData,
      currentBalance: currBal,
      totalRealizedGains: realizedGain,
      totalFloatingGains: floatingGain,
      todaysPnL: lastPnL,
      pnlPercentage: Math.round(pnlPct * 100) / 100,
      highValue: highVal,
      lowValue: lowVal,
      changePct: Math.round(pnlPct * 100) / 100,
      activeDate: activeRefDate,
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
        <div className="bg-[#0b0e17] border border-[#1e273d] rounded-xl p-3 shadow-2xl text-xs select-none">
          <div className="text-slate-400 text-[11px] mb-1.5 flex items-center justify-between gap-4">
            <span>{data.isCurrentSnapshot ? 'Titik Terkini' : `Exit: ${data.rawDate || data.date}`}</span>
            <span className="text-blue-400 font-semibold">{data.asset}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400">Akumulasi Laba:</span>
              <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}Rp {data.fullValue.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] pt-1 border-t border-[#1e273d]">
              <span className="text-slate-400">
                {data.isCurrentSnapshot ? 'Total Laba Floating:' : 'Laba Realized Transaksi:'}
              </span>
              <span className={`font-semibold ${isTradePositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isTradePositive ? '+' : ''}Rp {Math.round(data.pnl).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] pt-0.5">
              <span className="text-slate-500">Status:</span>
              <span
                className={`px-1.5 py-0.2 rounded font-semibold text-[9px] ${
                  data.status === 'Realized'
                    ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                    : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
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
        <div className="bg-[#0b0e17] border border-[#1e273d] rounded-xl p-3 shadow-2xl text-xs select-none min-w-[190px]">
          <div className="text-slate-400 text-[11px] mb-1.5 flex items-center justify-between gap-3">
            <span className="text-white font-bold text-sm">{data.asset}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                data.status === 'Realized'
                  ? 'bg-slate-700 text-slate-200 border border-slate-600'
                  : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
              }`}
            >
              {data.status}
            </span>
          </div>
          <div className="space-y-1 text-slate-300">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400">Tanggal:</span>
              <span className="text-slate-200">{data.rawDate}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400">Modal:</span>
              <span className="text-slate-200 font-medium">
                Rp {Math.round(data.nominalIdr).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#1e273d]">
              <span className="text-slate-400">Laba Bersih:</span>
              <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}Rp {data.fullValue.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400">Return (ROI):</span>
              <span className={`font-semibold ${data.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
    <div className="w-full select-none">
      <Card className="w-full bg-[#10141f] border border-[#1b2234] rounded-2xl shadow-xl overflow-hidden">
        <CardContent className="flex flex-col items-stretch gap-4 p-5 sm:p-6">
          {/* Header Balance Banner with Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  {chartType === 'line'
                    ? 'Akumulasi Pertumbuhan Laba Bersih (Realized + Floating)'
                    : 'Distribusi Laba / Rugi Per Transaksi'}
                </span>
                <span className="text-[11px] text-blue-400 font-medium px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                  Sinkron Google Sheet
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3.5 mt-1">
                <span
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    currentBalance >= 0 ? 'text-white' : 'text-rose-400'
                  }`}
                >
                  {currentBalance >= 0 ? '+' : ''}Rp {Math.round(currentBalance).toLocaleString('id-ID')}
                </span>
                <div
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${
                    pnlPercentage >= 0
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                      : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                  }`}
                >
                  {pnlPercentage >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{pnlPercentage >= 0 ? '+' : ''}{pnlPercentage}%</span>
                  <span className="text-slate-400 font-normal ml-0.5">Net ROI</span>
                </div>
              </div>
            </div>

            {/* Toggle Button: Line vs Bar */}
            <div className="flex items-center self-start sm:self-center bg-[#0b0e17] p-1 rounded-xl border border-[#1e273d]">
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'line'
                    ? 'bg-blue-600 text-white shadow-[0_2px_10px_rgba(37,99,235,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilkan Kurva Pertumbuhan Akumulasi"
              >
                <LineIcon className="w-3.5 h-3.5" />
                <span>Kurva Akumulasi</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  chartType === 'bar'
                    ? 'bg-blue-600 text-white shadow-[0_2px_10px_rgba(37,99,235,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilkan Diagram Batang Laba/Rugi Tiap Transaksi"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Hasil Per Transaksi</span>
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-between flex-wrap gap-2.5 text-xs pb-3 border-b border-[#1b2234]">
            {chartType === 'line' ? (
              <>
                {/* Recent PnL */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Transaksi Terakhir:</span>
                  <span className={`font-semibold ${todaysPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {todaysPnL >= 0 ? '+' : ''}Rp {Math.round(todaysPnL).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* High, Low, Realized Stats */}
                <div className="flex items-center gap-4 text-slate-400 text-xs font-medium">
                  <span>
                    High:{' '}
                    <span className="text-blue-400 font-semibold">{formatShortIdr(highValue)}</span>
                  </span>
                  <span>
                    Low:{' '}
                    <span className="text-amber-400 font-semibold">{formatShortIdr(lowValue)}</span>
                  </span>
                  <span>
                    Realized:{' '}
                    <span className="text-emerald-400 font-semibold">
                      Rp {Math.round(totalRealizedGains).toLocaleString('id-ID')}
                    </span>
                  </span>
                  <span>
                    Floating:{' '}
                    <span className="text-blue-400 font-semibold">
                      Rp {Math.round(totalFloatingGains).toLocaleString('id-ID')}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Win vs Loss Stats */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-slate-300 font-medium">
                      Profit: <strong className="text-emerald-400">{winCount}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    <span className="text-slate-300 font-medium">
                      Loss: <strong className="text-rose-400">{lossCount}</strong>
                    </span>
                  </div>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    Win Rate:{' '}
                    <strong className="text-white">
                      {Math.round((winCount / (winCount + lossCount || 1)) * 100)}%
                    </strong>
                  </span>
                </div>

                {/* Best Trade */}
                {bestTrade && (
                  <div className="text-slate-400">
                    Profit Tertinggi:{' '}
                    <span className="text-emerald-400 font-semibold">
                      +{formatShortIdr(bestTrade.pnl)} ({bestTrade.asset})
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chart Canvas Area */}
          <div className="grow mt-1">
            <ChartContainer
              config={chartConfig}
              className="h-80 w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
            >
              <ComposedChart
                data={(chartType === 'line' ? lineChartData : barChartData) as any}
                margin={{
                  top: 20,
                  right: 15,
                  left: 5,
                  bottom: 15,
                }}
              >
                <defs>
                  {/* Glowing gradient beneath white line */}
                  <linearGradient id="areaGradientWhite" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0a0d14" stopOpacity="0" />
                  </linearGradient>

                  {/* Dot Grid Pattern matching user script */}
                  <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1" fill="#334155" fillOpacity="0.35" />
                  </pattern>

                  {/* Drop Shadow for Highlight Dots */}
                  <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(255,255,255,0.7)" />
                  </filter>

                  {/* Glowing drop shadow for the white line */}
                  <filter id="lineShadow" x="-100%" y="-100%" width="300%" height="300%">
                    <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="rgba(255, 255, 255, 0.45)" />
                  </filter>
                </defs>

                {/* Background dot grid pattern */}
                <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" style={{ pointerEvents: 'none' }} />

                {/* Dashed Horizontal Cartesian Grid Lines */}
                <CartesianGrid
                  strokeDasharray="4 8"
                  stroke="#1e293b"
                  strokeOpacity={0.8}
                  horizontal={true}
                  vertical={false}
                />

                {/* Reference line for 0 point on bar chart or active tick on line */}
                {chartType === 'bar' ? (
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                ) : (
                  activeDate && (
                    <ReferenceLine
                      x={activeDate}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                  )
                )}

                <XAxis
                  dataKey={chartType === 'line' ? 'date' : 'name'}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickMargin={12}
                  interval={chartType === 'line' ? 'preserveStartEnd' : 0}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={value => {
                    const abs = Math.abs(value);
                    const prefix = value < 0 ? '-' : '';
                    if (abs >= 1) {
                      return `${prefix}Rp ${abs.toFixed(1)} Jt`;
                    }
                    return `${prefix}Rp ${Math.round(abs * 1000)} Rb`;
                  }}
                  tickMargin={12}
                  domain={chartType === 'line' ? ['dataMin - 0.2', 'dataMax + 0.2'] : ['auto', 'auto']}
                />

                <ChartTooltip
                  content={chartType === 'line' ? <CustomLineTooltip /> : <CustomBarTooltip />}
                  cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8', strokeOpacity: 0.5 }}
                />

                {/* MODE 1: THE WHITE CURVE LINE (Garis Line Putih Monokrom) */}
                {chartType === 'line' && (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#ffffff"
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
                            fill={isCurrent ? '#38bdf8' : '#ffffff'}
                            stroke="#10141f"
                            strokeWidth={2.5}
                            filter="url(#dotShadow)"
                          />
                        );
                      }

                      return <g key={`dot-empty-${payload.date}`} />;
                    }}
                    activeDot={{
                      r: 6.5,
                      fill: '#ffffff',
                      stroke: '#3b82f6',
                      strokeWidth: 2.5,
                      filter: 'url(#dotShadow)',
                    }}
                  />
                )}

                {/* MODE 2: HISTOGRAM BAR CHART (Hasil Laba / Rugi Tiap Transaksi) */}
                {chartType === 'bar' && (
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={38}>
                    {barChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={entry.fullValue >= 0 ? '#10b981' : '#f43f5e'}
                        fillOpacity={0.88}
                      />
                    ))}
                  </Bar>
                )}
              </ComposedChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
