import React, { useState, useMemo } from 'react';
import type { InvestmentRecord, TradeStatus } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface SidebarProps {
  records: InvestmentRecord[];
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
  selectedAsset: string | null;
  onSelectAsset: (asset: string | null) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (record: InvestmentRecord) => void;
  onOpenDeleteModal: (record: InvestmentRecord) => void;
  sheetConnected: boolean;
  sheetTitle: string;
  isSyncing: boolean;
  onManualSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  records,
  isCollapsed,
  onToggleCollapse: _onToggleCollapse,
  selectedAsset,
  onSelectAsset,
  onOpenAddModal,
  onOpenEditModal,
  onOpenDeleteModal,
  sheetConnected,
  sheetTitle,
  isSyncing,
  onManualSync,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'assets' | 'history'>('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TradeStatus>('ALL');

  // Filter valid investment records
  const validRecords = useMemo(() => {
    return records.filter(
      r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type)
    );
  }, [records]);

  // Aggregate by unique asset ticker for "Aset Portofolio" tab
  const assetAggregates = useMemo(() => {
    const map: Record<
      string,
      {
        asset: string;
        type: string;
        totalNominal: number;
        totalLabaBersih: number;
        pnlPercent: number;
        tradeCount: number;
        floatingCount: number;
        latestRecord: InvestmentRecord;
      }
    > = {};

    validRecords.forEach(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return;

      const key = r.asset.toUpperCase().trim();
      if (!map[key]) {
        map[key] = {
          asset: key,
          type: r.type,
          totalNominal: 0,
          totalLabaBersih: 0,
          pnlPercent: 0,
          tradeCount: 0,
          floatingCount: 0,
          latestRecord: r,
        };
      }

      map[key].totalNominal += r.nominalIdr || 0;
      map[key].totalLabaBersih += r.labaBersih || 0;
      map[key].tradeCount += 1;
      if (r.status === 'Floating') {
        map[key].floatingCount += 1;
      }
      map[key].latestRecord = r;
    });

    return Object.values(map)
      .map(item => {
        const pnl =
          item.totalNominal > 0 ? (item.totalLabaBersih / item.totalNominal) * 100 : 0;
        return { ...item, pnlPercent: pnl };
      })
      .filter(item =>
        item.asset.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => b.totalNominal - a.totalNominal);
  }, [validRecords, statusFilter, searchTerm]);

  // Filtered recent trades for "Riwayat" tab
  const recentTrades = useMemo(() => {
    return validRecords
      .filter(r => {
        const matchSearch =
          r.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.type.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .slice(0, 30);
  }, [validRecords, searchTerm, statusFilter]);

  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = [
      'Type',
      'Asset',
      'Nominal (IDR)',
      'Kurs IDR-USD',
      'Jumlah',
      'Entry Date',
      'Exit Date',
      'Entry Price',
      'Exit Price',
      'PnL',
      'SPREAD 0.5%',
      'Laba Bersih',
      'Notes',
      'Nilai Aset',
    ];

    const rows = records.map(r => [
      r.type,
      r.asset,
      r.nominalIdr,
      r.kursIdrUsd || '',
      r.jumlah,
      r.entryDate,
      r.exitDate || '',
      r.entryPrice,
      r.exitPrice || '',
      `${r.pnlPercent.toFixed(2)}%`,
      r.spreadCost,
      r.labaBersih,
      r.status,
      r.nilaiAset || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Portfolio_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <aside
      className={`h-[calc(100vh-3.25rem)] sticky top-13 bg-[#0c0f17] shrink-0 transition-[width,border-color] duration-300 ease-in-out overflow-hidden z-30 select-none ${
        isCollapsed ? 'w-0 border-r-0' : 'w-72 border-r border-[#1e2638]'
      }`}
      aria-hidden={isCollapsed}
    >
      <div className="w-72 h-full flex flex-col">
        {/* 1. Header Toolbar: Tabs */}
        <div className="p-2.5 border-b border-[#1a2233] flex items-center justify-between gap-1.5 bg-[#090c12]">
          <div className="flex items-center gap-1 bg-[#121724] p-0.5 rounded-md border border-[#1e2638] w-full">
            <button
              type="button"
              onClick={() => setSidebarTab('assets')}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors text-center ${
                sidebarTab === 'assets'
                  ? 'bg-[#1a2337] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aset Portofolio
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('history')}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors text-center ${
                sidebarTab === 'history'
                  ? 'bg-[#1a2337] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Riwayat
            </button>
          </div>
        </div>

      {/* 2. Primary Action Button (Matches '+ Tambah Customer Baru' style from reference) */}
      <div className="p-2.5 pb-2">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Posisi Baru</span>
        </button>
      </div>

      {/* 3. Search Bar */}
      <div className="px-2.5 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari ticker / aset..."
            className="w-full bg-[#090c12] border border-[#1e2638] rounded-md pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* 4. Quick Action Tags (.CSV, Refresh, All/Floating/Realized) */}
      <div className="px-2.5 pb-2 flex items-center justify-between gap-1 border-b border-[#1a2233]">
        {/* Format export buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV"
            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-300 bg-[#141a29] hover:bg-[#1a2337] border border-[#20293d] transition-colors flex items-center gap-1"
          >
            <Download className="w-3 h-3 text-slate-400" />
            <span>.CSV</span>
          </button>
          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            title="Sinkronkan Sheet"
            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-300 bg-[#141a29] hover:bg-[#1a2337] border border-[#20293d] transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 text-slate-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-0.5">
          {(['ALL', 'Floating', 'Realized'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'ALL' ? 'Semua' : f}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Scrollable List of Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sidebarTab === 'assets' ? (
          /* Assets View */
          assetAggregates.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Belum ada aset terdaftar.
            </div>
          ) : (
            assetAggregates.map(item => {
              const isSelected = selectedAsset === item.asset;
              const isPositive = item.pnlPercent >= 0;

              return (
                <div
                  key={item.asset}
                  onClick={() =>
                    onSelectAsset(isSelected ? null : item.asset)
                  }
                  className={`p-2 rounded-md border cursor-pointer transition-colors group relative ${
                    isSelected
                      ? 'bg-[#151c2c] border-blue-500/50'
                      : 'bg-[#090c12] border-[#1a2233] hover:border-slate-600 hover:bg-[#111724]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-white tracking-tight">
                      {item.asset}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-medium px-1 rounded tabular-nums ${
                        isPositive
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {item.pnlPercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span className="tabular-nums">
                      Rp {Math.round(item.totalNominal / 1000000)} Jt
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {item.tradeCount} trade
                      {item.floatingCount > 0 ? ` (${item.floatingCount} aktif)` : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Recent Trades History View */
          recentTrades.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Tidak ada data transaksi.
            </div>
          ) : (
            recentTrades.map(rec => {
              const isPositive = rec.labaBersih >= 0;
              return (
                <div
                  key={rec.id}
                  className="p-2 rounded-md bg-[#090c12] border border-[#1a2233] hover:border-slate-600 transition-colors group text-xs"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white">{rec.asset}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rec.type}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-medium tabular-nums ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {rec.pnlPercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span className="tabular-nums">
                      Rp {Math.round(rec.nominalIdr).toLocaleString('id-ID')}
                    </span>
                    <span className="text-slate-500">{rec.entryDate}</span>
                  </div>

                  {/* Quick Edit/Delete on Hover */}
                  <div className="pt-1 mt-1 border-t border-[#171e2e] flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                    <span
                      className={`text-[9px] px-1 rounded ${
                        rec.status === 'Realized'
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-amber-300 bg-amber-500/10'
                      }`}
                    >
                      {rec.status}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onOpenEditModal(rec);
                        }}
                        title="Edit transaksi"
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onOpenDeleteModal(rec);
                        }}
                        title="Hapus transaksi"
                        className="p-1 rounded text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* 6. Bottom System Status Bar */}
      <div className="p-2.5 border-t border-[#1a2233] bg-[#090c12] flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              sheetConnected ? 'bg-emerald-400' : 'bg-slate-500'
            }`}
          />
          <span className="truncate text-slate-300">
            {sheetConnected ? `Sheet: ${sheetTitle}` : 'Google Sheet Terputus'}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 shrink-0">
          {validRecords.length} baris
        </span>
      </div>
    </div>
  </aside>
);
};
