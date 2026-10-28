import React, { useState, useEffect, useMemo } from 'react';
import type { DividendRecord } from '../types';
import {
  X,
  Coins,
  Plus,
  Trash2,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Building2,
  Tag,
} from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';

interface DividendTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDividendsChange?: (dividends: DividendRecord[]) => void;
}

const STORAGE_KEY = 'investment_diary_dividends';

const INITIAL_DIVIDENDS: DividendRecord[] = [
  {
    id: 'DIV-1',
    asset: 'MSFT',
    date: '2026-03-12',
    nominalIdr: 450000,
    yieldPercent: 1.15,
    notes: 'Dividen Kas Kuartal 1',
    subAccount: 'Utama',
  },
  {
    id: 'DIV-2',
    asset: 'QQQ',
    date: '2026-04-20',
    nominalIdr: 320000,
    yieldPercent: 0.95,
    notes: 'Distribusi ETF Triwulanan',
    subAccount: 'Dividen',
  },
  {
    id: 'DIV-3',
    asset: 'GOLD',
    date: '2026-06-15',
    nominalIdr: 680000,
    yieldPercent: 2.1,
    notes: 'Yield Tabungan Emas Fisik',
    subAccount: 'Utama',
  },
];

export const DividendTrackerModal: React.FC<DividendTrackerModalProps> = ({
  isOpen,
  onClose,
  onDividendsChange,
}) => {
  const { formatPrivacyIdr } = usePrivacy();

  const [dividends, setDividends] = useState<DividendRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved dividends', e);
        }
      }
    }
    return INITIAL_DIVIDENDS;
  });

  // Form states
  const [asset, setAsset] = useState('MSFT');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [nominalIdr, setNominalIdr] = useState(500000);
  const [yieldPercent, setYieldPercent] = useState<number>(1.8);
  const [subAccount, setSubAccount] = useState('Utama');
  const [notes, setNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dividends));
    if (onDividendsChange) {
      onDividendsChange(dividends);
    }
  }, [dividends, onDividendsChange]);

  const totalDividendsIdr = useMemo(() => {
    return dividends.reduce((acc, d) => acc + (d.nominalIdr || 0), 0);
  }, [dividends]);

  const uniqueAssetsCount = useMemo(() => {
    return new Set(dividends.map(d => d.asset.toUpperCase())).size;
  }, [dividends]);

  const averageYield = useMemo(() => {
    const valid = dividends.filter(d => (d.yieldPercent || 0) > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((acc, d) => acc + (d.yieldPercent || 0), 0) / valid.length;
  }, [dividends]);

  if (!isOpen) return null;

  const handleAddDividend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset.trim() || nominalIdr <= 0) return;

    const newDiv: DividendRecord = {
      id: `DIV-${Date.now()}`,
      asset: asset.toUpperCase().trim(),
      date,
      nominalIdr: Number(nominalIdr),
      yieldPercent: Number(yieldPercent) || undefined,
      subAccount: subAccount.trim() || 'Utama',
      notes: notes.trim() || undefined,
    };

    setDividends(prev => [newDiv, ...prev]);
    setIsAdding(false);
    setAsset('');
    setNotes('');
    setNominalIdr(500000);
  };

  const handleDelete = (id: string) => {
    setDividends(prev => prev.filter(d => d.id !== id));
  };

  const handleExportCSV = () => {
    if (dividends.length === 0) return;
    const headers = ['Aset', 'Tanggal', 'Nominal (IDR)', 'Yield (%)', 'Sub-Akun', 'Catatan'];
    const rows = dividends.map(d => [
      d.asset,
      d.date,
      d.nominalIdr,
      d.yieldPercent || '',
      d.subAccount || '',
      `"${d.notes || ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Riwayat_Dividen_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-2xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-5 text-xs text-[#1c1917] dark:text-white space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e0d5] dark:border-[#1a2233]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#1c1917] dark:text-white">
                Pencatatan Aksi Korporasi &amp; Dividen Masuk
              </h2>
              <p className="text-[11px] text-[#6e685f] dark:text-slate-400 mt-0.5">
                Kelola aliran passive income dividen dan hak aksi korporasi per aset
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-[#faf8f4] dark:bg-[#090c12] border border-[#e5e0d5] dark:border-[#1a2233]">
            <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Total Dividen Terkumpul</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              +{formatPrivacyIdr(totalDividendsIdr)}
            </span>
            <span className="text-[9px] text-[#8a8377] block mt-0.5">Aliran passive income bersih</span>
          </div>

          <div className="p-3 rounded-xl bg-[#faf8f4] dark:bg-[#090c12] border border-[#e5e0d5] dark:border-[#1a2233]">
            <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Emiten Pembayar Dividen</span>
            <span className="text-base font-bold font-mono text-[#1c1917] dark:text-white mt-0.5 block">
              {uniqueAssetsCount} Aset
            </span>
            <span className="text-[9px] text-[#8a8377] block mt-0.5">{dividends.length} kali pencairan</span>
          </div>

          <div className="p-3 rounded-xl bg-[#faf8f4] dark:bg-[#090c12] border border-[#e5e0d5] dark:border-[#1a2233]">
            <span className="text-[10px] text-[#6e685f] dark:text-slate-400 block">Rata-Rata Yield</span>
            <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5 block">
              {averageYield.toFixed(2)}%
            </span>
            <span className="text-[9px] text-[#8a8377] block mt-0.5">Yield tahunan tertimbang</span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-semibold text-xs text-[#1c1917] dark:text-white">
            Riwayat Pembagian Dividen ({dividends.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#ded8cb] dark:border-[#1e2638] bg-[#ffffff] dark:bg-[#101520] hover:bg-[#f5f2ea] text-xs font-medium text-[#44403c] dark:text-slate-300 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'Batal' : 'Catat Dividen'}</span>
            </button>
          </div>
        </div>

        {/* Inline Add Form */}
        {isAdding && (
          <form
            onSubmit={handleAddDividend}
            className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 space-y-3"
          >
            <span className="font-semibold text-xs text-blue-900 dark:text-blue-300 block">
              Tambah Catatan Dividen Baru
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-1">Simbol Aset</label>
                <input
                  type="text"
                  required
                  value={asset}
                  onChange={e => setAsset(e.target.value.toUpperCase())}
                  placeholder="MSFT, BBCA"
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-1">Tanggal Cair</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-1">Nominal (IDR)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={nominalIdr}
                  onChange={e => setNominalIdr(Number(e.target.value))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-1">Yield (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={yieldPercent}
                  onChange={e => setYieldPercent(Number(e.target.value))}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-1">Sub-Akun</label>
                <select
                  value={subAccount}
                  onChange={e => setSubAccount(e.target.value)}
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="Utama">Akun Utama</option>
                  <option value="Dividen">Akun Dividen / Income</option>
                  <option value="Swing">Akun Swing</option>
                  <option value="Investasi Jangka Panjang">Investasi Jangka Panjang</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[#6e685f] dark:text-slate-400 mb-1">Catatan / Keterangan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Contoh: Dividen Final Tahun Buku 2025"
                  className="w-full bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Simpan Dividen
              </button>
            </div>
          </form>
        )}

        {/* Dividends List */}
        <div className="rounded-xl border border-[#e5e0d5] dark:border-[#1a2233] overflow-hidden max-h-64 overflow-y-auto">
          {dividends.length === 0 ? (
            <div className="p-6 text-center text-[#8a8377] dark:text-slate-500">
              Belum ada dividen tercatat. Klik "Catat Dividen" untuk menambahkan.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf8f4] dark:bg-[#090c12] text-[10px] uppercase font-mono text-[#6e685f] dark:text-slate-400 border-b border-[#e5e0d5] dark:border-[#1a2233]">
                <tr>
                  <th className="py-2 px-3">Aset</th>
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3 text-right">Nominal Cair</th>
                  <th className="py-2 px-3 text-right">Yield</th>
                  <th className="py-2 px-3">Akun</th>
                  <th className="py-2 px-3">Keterangan</th>
                  <th className="py-2 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e0d5] dark:divide-[#1a2233]">
                {dividends.map(div => (
                  <tr key={div.id} className="hover:bg-[#f7f5ef] dark:hover:bg-[#101522] transition-colors">
                    <td className="py-2 px-3 font-semibold font-mono text-[#1c1917] dark:text-white">
                      {div.asset}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#6e685f] dark:text-slate-400">{div.date}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatPrivacyIdr(div.nominalIdr)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#6e685f] dark:text-slate-400">
                      {div.yieldPercent ? `${div.yieldPercent}%` : '-'}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#efebe2] dark:bg-[#161d2d] text-[#57534e] dark:text-slate-400">
                        {div.subAccount || 'Utama'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[#6e685f] dark:text-slate-400 truncate max-w-40">
                      {div.notes || '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(div.id)}
                        title="Hapus baris dividen"
                        className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-[#e5e0d5] dark:border-[#1a2233]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#efebe2] dark:bg-[#161d2d] hover:bg-[#e5e0d5] text-xs font-medium text-[#44403c] dark:text-slate-300 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
