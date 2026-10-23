import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { InvestmentRecord } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  record: InvestmentRecord | null;
  sheetTitle: string;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  record,
  sheetTitle,
  isDeleting,
}) => {
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-5 text-xs text-[#1c1917] dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e0d5] dark:border-[#1a2233]">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="font-semibold text-sm tracking-tight text-[#1c1917] dark:text-white">Hapus Posisi Transaksi</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#8a8377] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#161d2d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3">
          <p className="text-[#44403c] dark:text-slate-300 leading-relaxed text-xs">
            Apakah Anda yakin ingin menghapus transaksi ini dari rekap dan Google Sheet tab{' '}
            <span className="text-[#1c1917] dark:text-slate-100 font-mono font-medium">"{sheetTitle}"</span>?
          </p>

          <div className="p-3 rounded-lg bg-[#fcfbfa] dark:bg-[#090c12] border border-[#ede8dc] dark:border-[#1a2233] space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6e685f] dark:text-slate-400">Aset:</span>
              <span className="text-[#1c1917] dark:text-white font-mono font-semibold">{record.asset} ({record.type})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e685f] dark:text-slate-400">Nominal:</span>
              <span className="text-[#1c1917] dark:text-slate-200 font-mono tabular-nums">Rp {Math.round(record.nominalIdr).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e685f] dark:text-slate-400">Entry Date:</span>
              <span className="text-[#57534e] dark:text-slate-300 font-mono">{record.entryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e685f] dark:text-slate-400">Baris Sheet:</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono font-medium">Baris ke-{record.rowNumber || 'N/A'}</span>
            </div>
          </div>

          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            Tindakan ini permanen dan akan menghapus baris terkait di file Google Sheet Anda.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ede8dc] dark:border-[#1a2233]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-[#44403c] dark:text-slate-300 bg-[#efebe2] dark:bg-[#161d2d] hover:bg-[#e4ded2] dark:hover:bg-[#1e273d] border border-[#ded8cb] dark:border-[#222c42] transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 border border-rose-400/30 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Menghapus...' : 'Hapus Posisi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
