import React, { useState, useEffect } from 'react';
import type { InvestmentRecord, TradeType, TradeStatus, EmotionType, StrategyType } from '../types';
import { X, Save, FileSpreadsheet, Brain, Star, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface AddEditTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<InvestmentRecord, 'rowNumber' | 'id'>) => Promise<void>;
  editingRecord: InvestmentRecord | null;
  defaultSymbol?: string;
  initialPrefill?: Partial<InvestmentRecord>;
}

export const AddEditTradeModal: React.FC<AddEditTradeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingRecord,
  defaultSymbol = 'NVDA',
  initialPrefill,
}) => {
  const [type, setType] = useState<TradeType>('BUY');
  const [asset, setAsset] = useState<string>(defaultSymbol);
  const [nominalIdr, setNominalIdr] = useState<number>(5000000);
  const [kursIdrUsd, setKursIdrUsd] = useState<number>(17890);
  const [jumlah, setJumlah] = useState<number>(1.0);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exitDate, setExitDate] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<number>(200);
  const [exitPrice, setExitPrice] = useState<number>(0);
  const [status, setStatus] = useState<TradeStatus>('Floating');
  const [subAccount, setSubAccount] = useState<string>('Utama');

  // Qualitative & Psychology states
  const [strategy, setStrategy] = useState<string>('Breakout');
  const [emotion, setEmotion] = useState<string>('Disiplin');
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [showPsychologySection, setShowPsychologySection] = useState(false);

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
      setSubAccount(editingRecord.subAccount || 'Utama');
      setStrategy(editingRecord.strategy || 'Breakout');
      setEmotion(editingRecord.emotion || 'Disiplin');
      setRating(editingRecord.rating || 5);
      setNotes(editingRecord.notes || '');
      if (editingRecord.emotion || editingRecord.notes || editingRecord.strategy) {
        setShowPsychologySection(true);
      }
    } else if (initialPrefill) {
      setType(initialPrefill.type || 'BUY');
      setAsset(initialPrefill.asset || defaultSymbol);
      setNominalIdr(initialPrefill.nominalIdr || 5000000);
      setKursIdrUsd(initialPrefill.kursIdrUsd || 17890);
      setJumlah(initialPrefill.jumlah || 1.0);
      setEntryDate(initialPrefill.entryDate || new Date().toISOString().split('T')[0]);
      setExitDate(initialPrefill.exitDate || '');
      setEntryPrice(initialPrefill.entryPrice || 200);
      setExitPrice(initialPrefill.exitPrice || 0);
      setStatus(initialPrefill.status || 'Floating');
      setSubAccount(initialPrefill.subAccount || 'Utama');
      setStrategy(initialPrefill.strategy || 'Breakout');
      setEmotion(initialPrefill.emotion || 'Disiplin');
      setRating(initialPrefill.rating || 5);
      setNotes(initialPrefill.notes || '');
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
      setSubAccount('Utama');
      setStrategy('Breakout');
      setEmotion('Disiplin');
      setRating(5);
      setNotes('');
      setShowPsychologySection(false);
    }
  }, [editingRecord, initialPrefill, defaultSymbol, isOpen]);

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
        subAccount: subAccount.trim() || 'Utama',
        strategy,
        emotion,
        rating,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save record:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs select-none overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-5 text-xs text-[#1c1917] dark:text-white space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e0d5] dark:border-[#1a2233]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-[#1c1917] dark:text-white">
                {editingRecord ? `Edit Baris Transaksi (${editingRecord.asset})` : 'Tambah Transaksi ke Google Sheet'}
              </h3>
              <p className="text-[11px] text-[#6e685f] dark:text-slate-400 mt-0.5">
                Simpan data posisi investasi &amp; jurnal psikologi trading
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8a8377] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#161d2d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Row 1: Sub-Account, Type, Asset */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Sub-Akun / Portofolio
              </label>
              <select
                value={subAccount}
                onChange={e => setSubAccount(e.target.value)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600"
              >
                <option value="Utama">Akun Utama</option>
                <option value="Swing">Akun Swing</option>
                <option value="Scalping">Akun Scalping / Fast</option>
                <option value="Dividen">Akun Dividen / Income</option>
                <option value="Kripto / Global">Kripto / Global</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Tipe
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TradeType)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 font-mono font-semibold"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Simbol Aset
              </label>
              <input
                type="text"
                required
                value={asset}
                onChange={e => setAsset(e.target.value)}
                placeholder="NVDA, GOLD, SPCX, QQQ..."
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white uppercase font-mono font-bold focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Row 2: Nominal, Kurs, Qty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Nominal Modal (IDR)
              </label>
              <input
                type="number"
                required
                min="0"
                value={nominalIdr}
                onChange={e => setNominalIdr(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Kurs IDR-USD
              </label>
              <input
                type="number"
                value={kursIdrUsd}
                onChange={e => setKursIdrUsd(parseFloat(e.target.value) || 0)}
                placeholder="17890"
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Jumlah (Qty / Lembar)
              </label>
              <input
                type="number"
                step="any"
                required
                value={jumlah}
                onChange={e => setJumlah(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Row 3: Entry Date & Exit Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Entry Date
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Exit Date (Opsional)
              </label>
              <input
                type="date"
                value={exitDate}
                onChange={e => setExitDate(e.target.value)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Row 4: Entry Price, Exit Price, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Entry Price
              </label>
              <input
                type="number"
                step="any"
                required
                value={entryPrice}
                onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Exit Price
              </label>
              <input
                type="number"
                step="any"
                value={exitPrice || ''}
                onChange={e => setExitPrice(parseFloat(e.target.value) || 0)}
                placeholder="Kosong jika floating"
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white font-mono tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                Status Posisi
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TradeStatus)}
                className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 font-semibold"
              >
                <option value="Floating">Floating (Aktif)</option>
                <option value="Realized">Realized (Selesai)</option>
              </select>
            </div>
          </div>

          {/* Real-time Computed Summary */}
          <div className="p-3 rounded-xl bg-[#faf8f4] dark:bg-[#090c12] border border-[#e5e0d5] dark:border-[#1a2233] grid grid-cols-3 gap-2 text-center text-xs font-mono shadow-2xs">
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

          {/* Qualitative & Psychology Accordion */}
          <div className="rounded-xl border border-[#ded8cb] dark:border-[#1e2638] overflow-hidden bg-[#faf8f4] dark:bg-[#090c12]">
            <button
              type="button"
              onClick={() => setShowPsychologySection(!showPsychologySection)}
              className="w-full flex items-center justify-between p-3 text-xs font-semibold text-[#1c1917] dark:text-white hover:bg-[#f0ece1] dark:hover:bg-[#101522] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Jurnal Kualitatif &amp; Psikologi Trading (Mindset &amp; Evaluasi)</span>
              </div>
              {showPsychologySection ? (
                <ChevronUp className="w-4 h-4 text-[#8a8377]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#8a8377]" />
              )}
            </button>

            {showPsychologySection && (
              <div className="p-3.5 border-t border-[#ded8cb] dark:border-[#1e2638] space-y-3 bg-[#ffffff] dark:bg-[#0c0f17]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                      Katalis / Setup Teknikal
                    </label>
                    <select
                      value={strategy}
                      onChange={e => setStrategy(e.target.value)}
                      className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white"
                    >
                      <option value="Breakout">Breakout Resistance</option>
                      <option value="Pullback">Pullback / Retest</option>
                      <option value="Support Bounce">Support Bounce</option>
                      <option value="Reversal">Reversal Bottom Fish</option>
                      <option value="Dividen">Dividen Play</option>
                      <option value="Momentum">Momentum Trend Following</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                      Emosi Saat Eksekusi
                    </label>
                    <select
                      value={emotion}
                      onChange={e => setEmotion(e.target.value)}
                      className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white"
                    >
                      <option value="Disiplin">Disiplin (Sesuai Trading Plan)</option>
                      <option value="FOMO">FOMO (Takut Ketinggalan Kereta)</option>
                      <option value="Revenge">Revenge Trade (Emosi Balas Dendam)</option>
                      <option value="Ragu">Ragu-ragu (Hesitant)</option>
                      <option value="Serakah">Serakah (Greed / Overstay)</option>
                      <option value="Panik">Panik (Panic Sell)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                      Disiplin Eksekusi (1-5 Bintang)
                    </label>
                    <div className="flex items-center gap-1 py-1.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-0.5 text-amber-400 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-[11px] font-mono font-semibold ml-1 text-[#6e685f] dark:text-slate-400">
                        {rating}/5
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#6e685f] dark:text-slate-400 font-medium block mb-1">
                    Evaluasi &amp; Pelajaran (Lesson Learned)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Contoh: Entry disiplin di retest EMA 20, jangan geser SL sembarangan saat harga sideways..."
                    className="w-full bg-[#f7f5ef] dark:bg-[#090c12] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg p-2.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded8cb] dark:border-[#1a2233]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#44403c] dark:text-slate-300 bg-[#efebe2] dark:bg-[#161d2d] hover:bg-[#e4ded2] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
