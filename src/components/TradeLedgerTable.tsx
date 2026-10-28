import React, { useState, useMemo } from 'react';
import type { InvestmentRecord, TradeStatus } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
import { detectDataAnomalies } from '../services/dataSanitizer';
import { usePrivacy } from '../context/PrivacyContext';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Unlink,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Layers,
  Brain,
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TradeLedgerTableProps {
  records: InvestmentRecord[];
  onOpenAddModal: () => void;
  onOpenEditModal: (record: InvestmentRecord) => void;
  onOpenDeleteModal: (record: InvestmentRecord) => void;
  sheetConnected: boolean;
  sheetTitle: string;
  onDisconnectSheet?: () => void;
  isSyncing?: boolean;
  onManualSync?: () => void;
  onOpenSanitizer?: () => void;
}

export const TradeLedgerTable: React.FC<TradeLedgerTableProps> = ({
  records,
  onOpenAddModal,
  onOpenEditModal,
  onOpenDeleteModal,
  sheetConnected,
  sheetTitle,
  onDisconnectSheet,
  isSyncing = false,
  onManualSync,
  onOpenSanitizer,
}) => {
  const { formatPrivacyIdr, formatPrivacyUsd, isPrivacyMode } = usePrivacy();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TradeStatus>('ALL');
  const [subAccountFilter, setSubAccountFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards'); // Default to cards/hybrid for superior mobile ergonomics
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Detect anomalies
  const sanitizationReport = useMemo(() => {
    return detectDataAnomalies(records);
  }, [records]);

  const anomalyMap = useMemo(() => {
    const map = new Set<string>();
    sanitizationReport.anomalies.forEach(a => map.add(a.recordId));
    return map;
  }, [sanitizationReport]);

  // Extract unique sub-accounts
  const availableSubAccounts = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.subAccount && r.subAccount.trim()) {
        set.add(r.subAccount.trim());
      }
    });
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Exclude non-investment/transport expenses
      if (isNonInvestmentOrExpense(rec.asset) || isNonInvestmentOrExpense(rec.type)) return false;

      const matchSearch =
        rec.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.entryDate && rec.entryDate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (rec.strategy && rec.strategy.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (rec.emotion && rec.emotion.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'ALL' || rec.status === statusFilter;
      const matchAccount =
        subAccountFilter === 'ALL' ||
        (rec.subAccount ? rec.subAccount.trim() === subAccountFilter : subAccountFilter === 'Utama');

      return matchSearch && matchStatus && matchAccount;
    });
  }, [records, searchTerm, statusFilter, subAccountFilter]);

  const formatPrice = (price: number, isGold: boolean) => {
    if (isGold) {
      return formatPrivacyIdr(price);
    }
    return formatPrivacyUsd(price);
  };

  const toggleExpandCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
      'Status',
      'Nilai Aset',
      'Sub-Akun',
      'Strategi',
      'Emosi',
      'Rating',
      'Catatan',
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
      r.subAccount || 'Utama',
      r.strategy || '',
      r.emotion || '',
      r.rating || '',
      `"${r.notes || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Portfolio_Database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#e5e0d5] dark:border-[#1e2638] overflow-hidden select-none shadow-2xs">
      {/* Top Toolbar */}
      <div className="p-3.5 border-b border-[#e5e0d5] dark:border-[#1a2233] bg-[#faf8f4] dark:bg-[#0c0f17] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="font-semibold text-sm text-[#1c1917] dark:text-white tracking-tight">
            Database Transaksi ({sheetTitle})
          </span>
          <span className="text-[#b8b0a2] dark:text-slate-600">·</span>
          <span className="text-xs font-mono text-[#6e685f] dark:text-slate-400 tabular-nums">
            {filteredRecords.length} posisi
          </span>

          {sanitizationReport.anomalies.length > 0 && onOpenSanitizer && (
            <button
              type="button"
              onClick={onOpenSanitizer}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>{sanitizationReport.anomalies.length} Anomali</span>
            </button>
          )}

          {isSyncing && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-700 dark:text-cyan-300 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-cyan-300" />
              <span>Menyinkronkan...</span>
            </span>
          )}

          {sheetConnected && onManualSync && !isSyncing && (
            <button
              type="button"
              onClick={onManualSync}
              title="Sinkronkan data sekarang"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#44403c] dark:text-slate-300 bg-[#ffffff] dark:bg-[#161d2d] hover:bg-[#f5f2ea] dark:hover:bg-[#1e273d] border border-[#ded8cb] dark:border-[#222c42] transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3 h-3 text-[#8a8377] dark:text-slate-400" />
              <span>Refresh</span>
            </button>
          )}

          {sheetConnected && onDisconnectSheet && (
            <button
              type="button"
              onClick={onDisconnectSheet}
              title="Putuskan koneksi Google Sheet saat ini"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20 transition-colors"
            >
              <Unlink className="w-3 h-3" />
              <span>Putuskan</span>
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-Account Filter */}
          <select
            value={subAccountFilter}
            onChange={e => setSubAccountFilter(e.target.value)}
            className="bg-[#ffffff] dark:bg-[#0e121b] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-slate-300 focus:outline-none focus:border-blue-600 shadow-2xs"
          >
            <option value="ALL">Semua Portofolio</option>
            <option value="Utama">Akun Utama</option>
            <option value="Swing">Akun Swing</option>
            <option value="Scalping">Akun Scalping</option>
            <option value="Dividen">Akun Dividen</option>
            {availableSubAccounts
              .filter(acc => !['Utama', 'Swing', 'Scalping', 'Dividen'].includes(acc))
              .map(acc => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-[#ffffff] dark:bg-[#0e121b] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-slate-300 focus:outline-none focus:border-blue-600 shadow-2xs"
          >
            <option value="ALL">Semua Status</option>
            <option value="Realized">Realized</option>
            <option value="Floating">Floating</option>
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8a8377] dark:text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari aset/strategi..."
              className="bg-[#ffffff] dark:bg-[#0e121b] border border-[#ded8cb] dark:border-[#1e2638] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#1c1917] dark:text-white placeholder:text-[#8a8377] dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 w-32 sm:w-44 transition-colors font-mono shadow-2xs"
            />
          </div>

          {/* View Mode Toggle: Table vs Cards (Ergonomi Mobile) */}
          <div className="flex items-center bg-[#efebe2] dark:bg-[#161d2d] p-0.5 rounded-lg border border-[#ded8cb] dark:border-[#222c42]">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Tampilan Kartu Ringkas (Ideal untuk Ponsel &amp; Tablet)"
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#0c0f17] text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-[#6e685f] dark:text-slate-400 hover:text-[#1c1917]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kartu</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel Spreadsheet Lengkap"
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#0c0f17] text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-[#6e685f] dark:text-slate-400 hover:text-[#1c1917]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabel</span>
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV"
            className="p-1.5 rounded-md text-[#44403c] dark:text-slate-300 bg-[#ffffff] dark:bg-[#161d2d] hover:bg-[#f5f2ea] dark:hover:bg-[#1e273d] border border-[#ded8cb] dark:border-[#222c42] transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-[#8a8377] dark:text-slate-300" />
          </button>

          {/* Add Trade Button */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/30 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tambah Posisi</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: RESPONSIVE MOBILE CARD VIEW (No sideways horizontal scrolling required!) */}
      {viewMode === 'cards' && (
        <div className="p-2.5 sm:p-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 max-h-[720px] overflow-y-auto">
          {filteredRecords.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#8a8377] dark:text-slate-500 text-xs">
              Tidak ada data transaksi yang cocok dengan filter.
            </div>
          ) : (
            filteredRecords.map(rec => {
              const isGold = rec.asset.toUpperCase() === 'GOLD';
              const isFloating = rec.status === 'Floating';
              const isProfit = (rec.labaBersih || 0) >= 0;
              const hasAnomaly = anomalyMap.has(rec.id);
              const isExpanded = !!expandedCards[rec.id];

              return (
                <div
                  key={rec.id}
                  className={`rounded-lg border transition-all duration-150 p-3 space-y-2.5 shadow-2xs relative ${
                    isFloating
                      ? 'border-l-4 border-l-blue-600 dark:border-l-blue-500 bg-[#ffffff] dark:bg-[#0c101a] border-y-[#e5e0d5] border-r-[#e5e0d5] dark:border-y-[#1e2638] dark:border-r-[#1e2638]'
                      : `border-l-4 ${
                          isProfit ? 'border-l-emerald-600 dark:border-l-emerald-500' : 'border-l-rose-600 dark:border-l-rose-500'
                        } bg-[#faf9f6] dark:bg-[#090c12] border-y-[#e5e0d5] border-r-[#e5e0d5] dark:border-y-[#1e2638] dark:border-r-[#1e2638]`
                  } ${hasAnomaly ? 'ring-1 ring-amber-500/50' : ''}`}
                >
                  {/* Card Header: Type, Asset, Sub-Account & High-Contrast Status Badge */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide ${
                          rec.type === 'BUY'
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950'
                            : 'bg-rose-600 text-white dark:bg-rose-500 dark:text-slate-950'
                        }`}
                      >
                        {rec.type}
                      </span>
                      <span className="font-mono font-bold text-sm tracking-tight text-[#1c1917] dark:text-white">
                        {rec.asset}
                      </span>
                      {rec.subAccount && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#efebe2] dark:bg-[#161d2d] text-[#57534e] dark:text-slate-400 font-medium">
                          {rec.subAccount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {hasAnomaly && (
                        <span
                          title="Anomali data terdeteksi pada baris ini"
                          className="p-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}

                      {/* Distinct Realized vs Floating Badge */}
                      {isFloating ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950 shadow-2xs">
                          <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>FLOATING</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-slate-700 text-white dark:bg-slate-800 dark:text-slate-200 shadow-2xs">
                          <CheckCircle2 className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>REALIZED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Core Value & Return Metrics - Visually tailored for Floating vs Realized */}
                  <div
                    className={`grid grid-cols-2 gap-2 p-2 rounded-md border ${
                      isFloating
                        ? 'bg-blue-500/[0.03] dark:bg-blue-500/[0.05] border-blue-500/20 dark:border-blue-500/15'
                        : 'bg-[#f4efe4]/60 dark:bg-[#07090f] border-[#ede8dc] dark:border-[#1a2233]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block font-medium">
                        {isFloating ? 'Modal Aktif' : 'Modal Awal'}
                      </span>
                      <span className="font-mono font-bold text-xs text-[#1c1917] dark:text-white block">
                        {formatPrivacyIdr(rec.nominalIdr)}
                      </span>
                      <span className="text-[10px] text-[#8a8377] dark:text-slate-500 block font-mono">
                        {rec.jumlah} {isGold ? 'gr' : 'unit'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block font-medium">
                        {isFloating ? 'Floating Return' : 'Laba Realized'}
                      </span>
                      <span
                        className={`font-mono font-bold text-xs flex items-center justify-end gap-1 ${
                          isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>
                          {rec.pnlPercent >= 0 ? '+' : ''}
                          {rec.pnlPercent.toFixed(2)}%
                        </span>
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold block ${
                          isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {formatPrivacyIdr(rec.labaBersih)}
                      </span>
                    </div>
                  </div>

                  {/* Qualitative badges (Strategy & Emotion) - Clean, small & compact */}
                  {(rec.strategy || rec.emotion || rec.rating) && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[9px] font-mono">
                      {rec.strategy && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 font-medium">
                          {rec.strategy}
                        </span>
                      )}
                      {rec.emotion && (
                        <span
                          className={`px-1.5 py-0.5 rounded border font-medium ${
                            rec.emotion === 'Disiplin'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20'
                          }`}
                        >
                          {rec.emotion}
                        </span>
                      )}
                      {rec.rating && (
                        <span className="flex items-center gap-0.5 text-amber-500 ml-auto font-mono text-[10px]">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>{rec.rating}/5</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable Details for Mobile */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-[#ede8dc] dark:border-[#1a2233] space-y-2 text-[11px] font-mono">
                      <div className="grid grid-cols-2 gap-2 text-[#57534e] dark:text-slate-300">
                        <div>
                          <span className="text-[10px] text-[#8a8377] block">Entry Price</span>
                          <span>{formatPrice(rec.entryPrice, isGold)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a8377] block">Exit Price</span>
                          <span>{rec.exitPrice ? formatPrice(rec.exitPrice, isGold) : '-'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a8377] block">Entry Date</span>
                          <span>{rec.entryDate || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a8377] block">Exit Date</span>
                          <span>{rec.exitDate || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a8377] block">Spread 0.5%</span>
                          <span>{formatPrivacyIdr(rec.spreadCost)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#8a8377] block">Nilai Posisi</span>
                          <span>{formatPrivacyIdr(rec.nilaiAset || rec.nominalIdr)}</span>
                        </div>
                      </div>

                      {rec.notes && (
                        <div className="p-2 rounded bg-[#f7f5ef] dark:bg-[#101520] text-[10px] text-[#57534e] dark:text-slate-400 italic">
                          "{rec.notes}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#ede8dc] dark:border-[#1a2233]">
                    <button
                      type="button"
                      onClick={() => toggleExpandCard(rec.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-white"
                    >
                      <span>{isExpanded ? 'Ringkas' : 'Detail'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(rec)}
                        title="Edit baris transaksi"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[#1c1917] dark:text-slate-200 bg-[#efebe2] dark:bg-[#161d2d] hover:bg-[#e4ded2] transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDeleteModal(rec)}
                        title="Hapus baris transaksi"
                        className="p-1 rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: FULL SPREADSHEET DESKTOP TABLE */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto max-h-[640px] relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#f7f5ef] dark:bg-[#090c12] z-10 border-b border-[#e5e0d5] dark:border-[#1e2638] text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-mono">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap font-medium">Tipe</th>
                <th className="py-2.5 px-3 whitespace-nowrap font-medium">Aset</th>
                <th className="py-2.5 px-3 whitespace-nowrap font-medium">Akun</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Nominal (IDR)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Kurs IDR-USD</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Jumlah</th>
                <th className="py-2.5 px-3 whitespace-nowrap font-medium">Entry Date</th>
                <th className="py-2.5 px-3 whitespace-nowrap font-medium">Exit Date</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Entry Price</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Exit Price</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">PnL %</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Spread 0.5%</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Laba Bersih</th>
                <th className="py-2.5 px-3 whitespace-nowrap font-medium">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ede8dc] dark:divide-[#1a2233] font-mono">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-[#8a8377] dark:text-slate-500 font-sans">
                    Tidak ada data transaksi yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isGold = rec.asset.toUpperCase() === 'GOLD';
                  const isFloating = rec.status === 'Floating';
                  const hasAnomaly = anomalyMap.has(rec.id);

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-[#f7f5ef] dark:hover:bg-[#101522] transition-colors ${
                        hasAnomaly ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.type === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-800 dark:text-rose-400'
                          }`}
                        >
                          {rec.type}
                        </span>
                      </td>

                      {/* Asset */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-[#1c1917] dark:text-white">
                        <div className="flex items-center gap-1.5">
                          {hasAnomaly && (
                            <span title="Anomali terdeteksi">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </span>
                          )}
                          <span>{rec.asset}</span>
                        </div>
                      </td>

                      {/* Sub-Account */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-[#6e685f] dark:text-slate-400">
                        {rec.subAccount || 'Utama'}
                      </td>

                      {/* Nominal */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-[#1c1917] dark:text-slate-200">
                        {formatPrivacyIdr(rec.nominalIdr)}
                      </td>

                      {/* Kurs */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-[#6e685f] dark:text-slate-400">
                        {rec.kursIdrUsd ? rec.kursIdrUsd.toLocaleString('id-ID') : '-'}
                      </td>

                      {/* Jumlah */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-[#1c1917] dark:text-slate-200">
                        {rec.jumlah}
                      </td>

                      {/* Entry Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#6e685f] dark:text-slate-400">
                        {rec.entryDate || '-'}
                      </td>

                      {/* Exit Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#6e685f] dark:text-slate-400">
                        {rec.exitDate || '-'}
                      </td>

                      {/* Entry Price */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-[#1c1917] dark:text-slate-200">
                        {formatPrice(rec.entryPrice, isGold)}
                      </td>

                      {/* Exit Price */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-[#1c1917] dark:text-slate-200">
                        {rec.exitPrice ? formatPrice(rec.exitPrice, isGold) : '-'}
                      </td>

                      {/* PnL % */}
                      <td
                        className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums font-semibold ${
                          rec.pnlPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {rec.pnlPercent >= 0 ? '+' : ''}
                        {rec.pnlPercent.toFixed(2)}%
                      </td>

                      {/* Spread Cost */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-[#8a8377] dark:text-slate-500">
                        {formatPrivacyIdr(rec.spreadCost)}
                      </td>

                      {/* Laba Bersih */}
                      <td
                        className={`py-2.5 px-3 text-right whitespace-nowrap tabular-nums font-semibold ${
                          rec.labaBersih >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {rec.labaBersih >= 0 ? '+' : ''}
                        {formatPrivacyIdr(rec.labaBersih)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            isFloating
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-[#efebe2] dark:bg-[#161d2d] text-[#57534e] dark:text-slate-400 border border-[#ded8cb] dark:border-[#222c42]'
                          }`}
                        >
                          {isFloating ? <Clock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                          <span>{rec.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(rec)}
                            title="Edit baris di Google Sheet"
                            className="p-1 rounded text-[#6e685f] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#1e2638] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDeleteModal(rec)}
                            title="Hapus baris dari Google Sheet"
                            className="p-1 rounded text-[#8a8377] hover:text-rose-700 hover:bg-rose-50 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
