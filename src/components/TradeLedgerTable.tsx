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
} from 'lucide-react';
import { LiquidButton, Button } from '@/components/ui/liquid-glass-button';

interface TradeLedgerTableProps {
  records: InvestmentRecord[];
  onOpenAddModal: () => void;
  onOpenEditModal: (record: InvestmentRecord) => void;
  onOpenDeleteModal: (record: InvestmentRecord) => void;
  sheetConnected: boolean;
  sheetTitle: string;
  onDisconnectSheet?: () => void;
}

export const TradeLedgerTable: React.FC<TradeLedgerTableProps> = ({
  records,
  onOpenAddModal,
  onOpenEditModal,
  onOpenDeleteModal,
  sheetConnected,
  sheetTitle,
  onDisconnectSheet,
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
    link.setAttribute('download', `Rekap_INVESTMENT_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#10141f] rounded-2xl border border-[#1b2234] overflow-hidden select-none">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Rekap Transaksi Google Sheet
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Tab: {sheetTitle}
          </span>
          {sheetConnected && onDisconnectSheet && (
            <button
              type="button"
              onClick={onDisconnectSheet}
              title="Putuskan koneksi Google Sheet saat ini"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
            >
              <Unlink className="w-3 h-3" />
              <span>Putuskan</span>
            </button>
          )}
          <span className="text-xs text-slate-400">
            ({filteredRecords.length} transaksi)
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari aset (NVDA, GOLD)..."
              className="bg-[#0b0e17] border border-[#1e273d] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="Realized">Realized</option>
            <option value="Floating">Floating</option>
          </select>

          {/* Export CSV */}
          <LiquidButton
            onClick={handleExportCSV}
            title="Download CSV"
            size="icon"
            variant="secondary"
            className="w-8 h-8 rounded-xl"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
          </LiquidButton>

          {/* Add Trade Button */}
          <LiquidButton
            onClick={onOpenAddModal}
            variant="primary"
            size="sm"
            className="gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.6)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Posisi</span>
          </LiquidButton>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0b0e17] border-b border-[#1b2234] text-[11px] font-semibold text-slate-400">
              <th className="py-3 px-3.5">Type</th>
              <th className="py-3 px-3.5">Asset</th>
              <th className="py-3 px-3.5 text-right">Nominal (IDR)</th>
              <th className="py-3 px-3.5 text-right">Kurs IDR-USD</th>
              <th className="py-3 px-3.5 text-right">Jumlah</th>
              <th className="py-3 px-3.5">Entry Date</th>
              <th className="py-3 px-3.5">Exit Date</th>
              <th className="py-3 px-3.5 text-right">Entry Price</th>
              <th className="py-3 px-3.5 text-right">Exit Price</th>
              <th className="py-3 px-3.5 text-right">PnL (%)</th>
              <th className="py-3 px-3.5 text-right">Spread 0.5%</th>
              <th className="py-3 px-3.5 text-right">Laba Bersih</th>
              <th className="py-3 px-3.5 text-center">Status</th>
              <th className="py-3 px-3.5 text-right">Nilai Aset</th>
              <th className="py-3 px-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171d2c]">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-12 text-center text-slate-500 text-xs">
                  {!sheetConnected ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-400">Google Sheet Terputus</p>
                      <p className="text-slate-500 text-[11px]">Semua metrik dan aset diatur ke 0. Hubungkan Google Sheet di menu "Koneksi Sheet" untuk memuat data Anda.</p>
                    </div>
                  ) : (
                    'Tidak ada data posisi yang cocok. Klik "+ Tambah Posisi" untuk menambahkan transaksi ke Google Sheet.'
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
                    className="hover:bg-[#141b29] transition-colors group"
                  >
                    {/* Type */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {rec.type}
                      </span>
                    </td>

                    {/* Asset */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-bold text-white">
                      <span>{rec.asset}</span>
                    </td>

                    {/* Nominal IDR */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-200 font-medium">
                      {formatIdr(rec.nominalIdr)}
                    </td>

                    {/* Kurs IDR-USD */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-400">
                      {rec.kursIdrUsd ? rec.kursIdrUsd.toLocaleString('id-ID') : '—'}
                    </td>

                    {/* Jumlah */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-300">
                      {rec.jumlah.toLocaleString('id-ID', { minimumFractionDigits: 3 })}
                    </td>

                    {/* Entry Date */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-300">
                      {rec.entryDate || '—'}
                    </td>

                    {/* Exit Date */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                      {rec.exitDate || '—'}
                    </td>

                    {/* Entry Price */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-200">
                      {formatPrice(rec.entryPrice, isGold)}
                    </td>

                    {/* Exit Price */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-200">
                      {rec.exitPrice ? formatPrice(rec.exitPrice, isGold) : '—'}
                    </td>

                    {/* PnL % */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap font-bold">
                      <span className={rec.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {rec.pnlPercent >= 0 ? '+' : ''}{rec.pnlPercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* SPREAD 0.5% */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-rose-400/80">
                      {rec.spreadCost ? formatIdr(rec.spreadCost) : '—'}
                    </td>

                    {/* Laba Bersih */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap font-bold">
                      <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                        {isPositive ? '+' : ''}{formatIdr(rec.labaBersih)}
                      </span>
                    </td>

                    {/* Status (Notes) */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          rec.status === 'Realized'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
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
                    <td className="py-3 px-3.5 text-right whitespace-nowrap text-slate-200 font-medium">
                      {rec.nilaiAset ? formatIdr(rec.nilaiAset) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <LiquidButton
                          onClick={() => onOpenEditModal(rec)}
                          title="Edit baris"
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-white/10"
                        >
                          <Edit2 className="w-3 h-3" />
                        </LiquidButton>
                        <LiquidButton
                          onClick={() => onOpenDeleteModal(rec)}
                          title="Hapus baris"
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15"
                        >
                          <Trash2 className="w-3 h-3" />
                        </LiquidButton>
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
