import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { InvestmentRecord } from '../types';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-md rounded-2xl bg-[#10141f] border border-[#1b2234] shadow-2xl p-5 text-xs text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2234]">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-sm tracking-tight text-white">Konfirmasi Hapus Transaksi</h3>
          </div>
          <LiquidButton
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </LiquidButton>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3">
          <p className="text-slate-300 leading-relaxed">
            Apakah Anda yakin ingin menghapus baris transaksi ini dari tabel dan spreadsheet Google Sheet tab{' '}
            <strong className="text-blue-400">"{sheetTitle}"</strong>?
          </p>

          <div className="p-3.5 rounded-xl bg-[#0b0e17] border border-[#171d2c] space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Aset:</span>
              <span className="text-white font-bold">{record.asset} ({record.type})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Nominal:</span>
              <span className="text-white font-medium">Rp {Math.round(record.nominalIdr).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Entry Date:</span>
              <span className="text-slate-300">{record.entryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Baris Google Sheet:</span>
              <span className="text-blue-400 font-semibold">Baris ke-{record.rowNumber || 'N/A'}</span>
            </div>
          </div>

          <p className="text-[11px] text-rose-400 font-medium">
            Tindakan ini permanen dan akan menghapus baris terkait di file Google Sheet.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1b2234]">
          <LiquidButton
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            variant="secondary"
            size="md"
            className="px-4 py-2 rounded-xl text-slate-300 font-semibold"
          >
            Batal
          </LiquidButton>
          <LiquidButton
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            variant="destructive"
            size="md"
            className="px-5 py-2 rounded-xl font-bold gap-1.5 shadow-[0_4px_16px_rgba(225,29,72,0.4)] disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Menghapus...' : 'Hapus Baris'}</span>
          </LiquidButton>
        </div>
      </div>
    </div>
  );
};
