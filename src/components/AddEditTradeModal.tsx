import React, { useState, useEffect } from 'react';
import type { InvestmentRecord, TradeType, TradeStatus } from '../types';
import { X, Save, FileSpreadsheet } from 'lucide-react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg rounded-2xl bg-[#10141f] border border-[#1b2234] shadow-2xl p-5 text-xs text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2234]">
          <div className="flex items-center gap-2 text-white">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm tracking-tight">
              {editingRecord ? `Edit Baris (${editingRecord.asset})` : 'Tambah Transaksi ke Google Sheet'}
            </h3>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">TYPE</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TradeType)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">ASSET</label>
              <input
                type="text"
                required
                value={asset}
                onChange={e => setAsset(e.target.value)}
                placeholder="NVDA, GOLD, SPCX, QQQ, MSTR..."
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">NOMINAL (IDR)</label>
              <input
                type="number"
                required
                value={nominalIdr}
                onChange={e => setNominalIdr(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">KURS IDR-USD</label>
              <input
                type="number"
                value={kursIdrUsd}
                onChange={e => setKursIdrUsd(parseFloat(e.target.value) || 0)}
                placeholder="17890"
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">JUMLAH (QTY)</label>
              <input
                type="number"
                step="any"
                required
                value={jumlah}
                onChange={e => setJumlah(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">ENTRY DATE</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">EXIT DATE (OPTIONAL)</label>
              <input
                type="date"
                value={exitDate}
                onChange={e => setExitDate(e.target.value)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">ENTRY PRICE</label>
              <input
                type="number"
                step="any"
                required
                value={entryPrice}
                onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">EXIT PRICE / NOW</label>
              <input
                type="number"
                step="any"
                value={exitPrice || ''}
                onChange={e => setExitPrice(parseFloat(e.target.value) || 0)}
                placeholder="Kosongkan jika floating"
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1">STATUS (NOTES)</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TradeStatus)}
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Floating">Floating (Aktif)</option>
                <option value="Realized">Realized (Selesai)</option>
              </select>
            </div>
          </div>

          {/* Real-time Computed Summary */}
          <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#171d2c] grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">EST. PnL %</span>
              <span className={`font-bold ${pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">SPREAD 0.5%</span>
              <span className="text-rose-400 font-medium">
                Rp {spreadCost.toLocaleString('id-ID')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">EST. LABA BERSIH</span>
              <span className={`font-bold ${labaBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {labaBersih >= 0 ? '+' : ''}Rp {labaBersih.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1b2234]">
            <LiquidButton
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              variant="secondary"
              size="md"
              className="px-4 py-2 rounded-xl text-slate-300 font-semibold"
            >
              Batal
            </LiquidButton>
            <LiquidButton
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              size="md"
              className="px-5 py-2 rounded-xl font-bold gap-1.5 shadow-[0_4px_16px_rgba(37,99,235,0.4)] disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan ke Google Sheet'}</span>
            </LiquidButton>
          </div>
        </form>
      </div>
    </div>
  );
};
