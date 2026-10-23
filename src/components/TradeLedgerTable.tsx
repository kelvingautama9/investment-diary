import React, { useState, useMemo } from 'react';
import type { InvestmentRecord, TradeStatus } from '../types';
import { isNonInvestmentOrExpense } from '../services/googleSheets';
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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TradeStatus>('ALL');

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Exclude non-investment/transport expenses
      if (isNonInvestmentOrExpense(rec.asset) || isNonInvestmentOrExpense(rec.type)) return false;

      const matchSearch =
        rec.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.entryDate && rec.entryDate.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'ALL' || rec.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const formatIdr = (num: number) => {
    return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
  };

  const formatPrice = (price: number, isGold: boolean) => {
    if (isGold) {
      return `Rp ${Math.round(price).toLocaleString('id-ID')}`;
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
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
            {filteredRecords.length} transaksi
          </span>

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
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8a8377] dark:text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari aset (NVDA, GOLD)..."
              className="bg-[#ffffff] dark:bg-[#0e121b] border border-[#ded8cb] dark:border-[#1e2638] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#1c1917] dark:text-white placeholder:text-[#8a8377] dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 dark:focus:border-slate-400 w-36 sm:w-52 transition-colors font-mono shadow-2xs"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-[#ffffff] dark:bg-[#0e121b] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-slate-300 focus:outline-none focus:border-blue-600 dark:focus:border-slate-400 shadow-2xs"
          >
            <option value="ALL">Semua Status</option>
            <option value="Realized">Realized</option>
            <option value="Floating">Floating</option>
          </select>

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
            <span>Tambah Posisi</span>
          </button>
        </div>
      </div>

      {/* Table Container with Sticky Header */}
      <div className="overflow-x-auto max-h-[640px] relative">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[#f7f5ef] dark:bg-[#090c12] z-10 border-b border-[#e5e0d5] dark:border-[#1e2638] text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-mono">
            <tr>
              <th className="py-2.5 px-3 whitespace-nowrap font-medium">Tipe</th>
              <th className="py-2.5 px-3 whitespace-nowrap font-medium">Aset</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Nominal (IDR)</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Kurs IDR-USD</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Jumlah</th>
              <th className="py-2.5 px-3 whitespace-nowrap font-medium">Entry Date</th>
              <th className="py-2.5 px-3 whitespace-nowrap font-medium">Exit Date</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Entry Price</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Exit Price</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">PnL (%)</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Spread 0.5%</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Laba Bersih</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap font-medium">Status</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Nilai Aset</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ede8dc] dark:divide-[#171e2e]">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-12 text-center text-[#8a8377] dark:text-slate-500 text-xs">
                  {!sheetConnected ? (
                    <div className="space-y-1">
                      <p className="font-medium text-[#1c1917] dark:text-slate-300">Google Sheet Belum Terhubung</p>
                      <p className="text-[#6e685f] dark:text-slate-500 text-[11px]">Hubungkan Google Sheet di tab "Koneksi Sheet" untuk memuat rekap transaksi Anda.</p>
                    </div>
                  ) : (
                    'Tidak ada transaksi yang cocok dengan filter pencarian.'
                  )}
                </td>
              </tr>
            ) : (
              filteredRecords.map(rec => {
                const isPositive = rec.labaBersih >= 0;
                const isGold = rec.asset.toUpperCase() === 'GOLD';

                return (
                  <tr
                    key={rec.id}
                    className="hover:bg-[#f7f5ef] dark:hover:bg-[#121724] transition-colors group"
                  >
                    {/* Type */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-[#57534e] dark:text-slate-300">
                        {rec.type}
                      </span>
                    </td>

                    {/* Asset */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-[#1c1917] dark:text-white">
                      <span>{rec.asset}</span>
                    </td>

                    {/* Nominal IDR */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#1c1917] dark:text-slate-200 font-mono tabular-nums">
                      {formatIdr(rec.nominalIdr)}
                    </td>

                    {/* Kurs IDR-USD */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#57534e] dark:text-slate-400 font-mono tabular-nums">
                      {rec.kursIdrUsd ? rec.kursIdrUsd.toLocaleString('id-ID') : '—'}
                    </td>

                    {/* Jumlah */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#292524] dark:text-slate-300 font-mono tabular-nums">
                      {rec.jumlah.toLocaleString('id-ID', { minimumFractionDigits: 3 })}
                    </td>

                    {/* Entry Date */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-[#57534e] dark:text-slate-400 font-mono text-[11px]">
                      {rec.entryDate || '—'}
                    </td>

                    {/* Exit Date */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-[#57534e] dark:text-slate-400 font-mono text-[11px]">
                      {rec.exitDate || '—'}
                    </td>

                    {/* Entry Price */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#1c1917] dark:text-slate-200 font-mono tabular-nums">
                      {formatPrice(rec.entryPrice, isGold)}
                    </td>

                    {/* Exit Price */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#1c1917] dark:text-slate-200 font-mono tabular-nums">
                      {rec.exitPrice ? formatPrice(rec.exitPrice, isGold) : '—'}
                    </td>

                    {/* PnL % */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold">
                      <span className={rec.pnlPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                        {rec.pnlPercent >= 0 ? '+' : ''}{rec.pnlPercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* SPREAD 0.5% */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#57534e] dark:text-slate-400 font-mono tabular-nums">
                      {rec.spreadCost ? formatIdr(rec.spreadCost) : '—'}
                    </td>

                    {/* Laba Bersih */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold">
                      <span className={isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                        {isPositive ? '+' : ''}{formatIdr(rec.labaBersih)}
                      </span>
                    </td>

                    {/* Status (Notes) */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                          rec.status === 'Realized'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25'
                        }`}
                      >
                        {rec.status === 'Realized' ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <Clock className="w-2.5 h-2.5" />
                        )}
                        <span>{rec.status}</span>
                      </span>
                    </td>

                    {/* Nilai Aset */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-[#1c1917] dark:text-slate-200 font-mono tabular-nums">
                      {rec.nilaiAset ? formatIdr(rec.nilaiAset) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(rec)}
                          title="Edit baris"
                          className="p-1 rounded text-[#8a8377] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#1a2233] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDeleteModal(rec)}
                          title="Hapus baris"
                          className="p-1 rounded text-[#8a8377] hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/15 transition-colors"
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
    </div>
  );
};
