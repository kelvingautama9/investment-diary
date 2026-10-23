import React, { useState, useEffect } from 'react';
import type { InvestmentRecord, TradeType, TradeStatus } from '../types';
import { X, Save, FileSpreadsheet } from 'lucide-react';

interface AddEditTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<InvestmentRecord, 'rowNumber' | 'id'>) => Promise<void>;
  editingRecord: InvestmentRecord | null;
  defaultSymbol?: string;
}

export const AddEditTradeModal: React.FC<AddEditTradeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRecord,
  defaultSymbol = 'NVDA',
}) => {
  const [type, setType] = useState<TradeType>('BUY');
  const [asset, setAsset] = useState<string>(defaultSymbol);
  const [nominalIdr, setNominalIdr] = useState<number>(5000000);
  const [kursIdrUsd, setKursIdrUsd] = useState<number>(17890);
  const [jumlah, setJumlah] = useState<number>(1.0);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exitDate, setExitDate] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<number>(200);
  const [exitPrice, setExitPrice] = useState<number>(220);
  const [status, setStatus] = useState<TradeStatus>('Floating');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingRecord) {
      setType(editingRecord.type);
      setAsset(editingRecord.asset);
      setNominalIdr(editingRecord.nominalIdr);
      setKursIdrUsd(editingRecord.kursIdrUsd || 17890);
      setJumlah(editingRecord.jumlah);
      setEntryDate(editingRecord.entryDate);
      setExitDate(editingRecord.exitDate || '');
      setEntryPrice(editingRecord.entryPrice);
      setExitPrice(editingRecord.exitPrice || 0);
      setStatus(editingRecord.status);
    } else {
      setType('BUY');
      setAsset(defaultSymbol);
      setNominalIdr(5000000);
      setKursIdrUsd(17890);
      setJumlah(1.0);
      setEntryDate(new Date().toISOString().split('T')[0]);
      setExitDate('');
      setEntryPrice(200);
      setExitPrice(0);
      setStatus('Floating');
    }
  }, [editingRecord, defaultSymbol, isOpen]);

  if (!isOpen) return null;

  // Auto computations
  const effectiveExit = exitPrice > 0 ? exitPrice : entryPrice;
  const pnlPercent = entryPrice > 0 ? ((effectiveExit - entryPrice) / entryPrice) * 100 : 0;
  const spreadCost = -Math.round(nominalIdr * 0.005);
  const labaBersih = Math.round((nominalIdr * pnlPercent) / 100 + spreadCost);
  const nilaiAset = status === 'Floating' ? nominalIdr + labaBersih : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        type,
        asset: asset.toUpperCase().trim(),
        nominalIdr: Number(nominalIdr) || 0,
        kursIdrUsd: Number(kursIdrUsd) || 0,
        jumlah: Number(jumlah) || 0,
        entryDate,
        exitDate: exitDate.trim() ? exitDate : undefined,
        entryPrice: Number(entryPrice) || 0,
        exitPrice: exitPrice > 0 ? Number(exitPrice) : undefined,
        pnlPercent,
        spreadCost,
        labaBersih,
        status,
        nilaiAset,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save record:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-5 text-xs text-[#1c1917] dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e0d5] dark:border-[#1a2233]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm tracking-tight text-[#1c1917] dark:text-white">
              {editingRecord ? `Edit Baris (${editingRecord.asset})` : 'Tambah Transaksi ke Google Sheet'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#8a8377] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#161d2d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Tipe</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TradeType)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-slate-400 font-mono"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Aset</label>
              <input
                type="text"
                required
                value={asset}
                onChange={e => setAsset(e.target.value)}
                placeholder="NVDA, GOLD, SPCX, QQQ..."
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white uppercase font-mono font-medium focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Nominal (IDR)</label>
              <input
                type="number"
                required
                value={nominalIdr}
                onChange={e => setNominalIdr(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Kurs IDR-USD</label>
              <input
                type="number"
                value={kursIdrUsd}
                onChange={e => setKursIdrUsd(parseFloat(e.target.value) || 0)}
                placeholder="17890"
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Jumlah (Qty)</label>
              <input
                type="number"
                step="any"
                required
                value={jumlah}
                onChange={e => setJumlah(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Entry Date</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Exit Date (Opsional)</label>
              <input
                type="date"
                value={exitDate}
                onChange={e => setExitDate(e.target.value)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Entry Price</label>
              <input
                type="number"
                step="any"
                required
                value={entryPrice}
                onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Exit Price</label>
              <input
                type="number"
                step="any"
                value={exitPrice || ''}
                onChange={e => setExitPrice(parseFloat(e.target.value) || 0)}
                placeholder="Kosongkan jika aktif"
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TradeStatus)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-md px-3 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-slate-400"
              >
                <option value="Floating">Floating (Aktif)</option>
                <option value="Realized">Realized (Selesai)</option>
              </select>
            </div>
          </div>

          {/* Real-time Computed Summary */}
          <div className="p-3 rounded-lg bg-[#fcfbfa] dark:bg-[#090c12] border border-[#ede8dc] dark:border-[#1a2233] grid grid-cols-3 gap-2 text-center text-xs font-mono shadow-2xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-500 block">Est. PnL %</span>
              <span className={`font-semibold tabular-nums ${pnlPercent >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-500 block">Spread 0.5%</span>
              <span className="text-[#292524] dark:text-slate-300 tabular-nums font-medium">
                Rp {spreadCost.toLocaleString('id-ID')}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-500 block">Est. Laba Bersih</span>
              <span className={`font-semibold tabular-nums ${labaBersih >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {labaBersih >= 0 ? '+' : ''}Rp {labaBersih.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ede8dc] dark:border-[#1a2233]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-[#44403c] dark:text-slate-300 bg-[#efebe2] dark:bg-[#161d2d] hover:bg-[#e4ded2] dark:hover:bg-[#1e273d] border border-[#ded8cb] dark:border-[#222c42] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/30 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan ke Google Sheet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
