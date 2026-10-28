import React from 'react';
import type { InvestmentRecord, DataAnomaly } from '../types';
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface DataSanitizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: DataAnomaly[];
  records: InvestmentRecord[];
  onEditRecord: (record: InvestmentRecord) => void;
}

export const DataSanitizationModal: React.FC<DataSanitizationModalProps> = ({
  isOpen,
  onClose,
  anomalies,
  records,
  onEditRecord,
}) => {
  if (!isOpen) return null;

  const errorCount = anomalies.filter(a => a.severity === 'error').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;

  const handleFixAnomaly = (anomaly: DataAnomaly) => {
    const targetRecord = records.find(r => r.id === anomaly.recordId);
    if (targetRecord) {
      onClose();
      onEditRecord(targetRecord);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl rounded-2xl bg-[#ffffff] dark:bg-[#0c0f17] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-5 text-xs text-[#1c1917] dark:text-white space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e0d5] dark:border-[#1a2233]">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                anomalies.length > 0
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              {anomalies.length > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#1c1917] dark:text-white">
                Pemeriksa Anomali &amp; Sanitasi Data Transaksi
              </h2>
              <p className="text-[11px] text-[#6e685f] dark:text-slate-400 mt-0.5">
                Mendeteksi kesalahan kronologis tanggal, selisih harga, typo desimal, dan inkonsistensi status
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

        {/* Status Banner */}
        {anomalies.length === 0 ? (
          <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
              Semua Data Transaksi Bersih &amp; Konsisten
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400/80 max-w-md mx-auto">
              Tidak ditemukan anomali tanggal mendahului, selisih status realized tanpa harga exit, ataupun typo persentase ekstrem pada {records.length} data transaksi Anda.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold">
                Ditemukan {anomalies.length} potensi anomali pada database:
              </span>{' '}
              {errorCount > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">
                  {errorCount} Kritis (Perlu Diperbaiki)
                </span>
              )}
              {errorCount > 0 && warningCount > 0 && <span>, </span>}
              {warningCount > 0 && (
                <span className="text-amber-700 dark:text-amber-300 font-mono">
                  {warningCount} Peringatan (Disarankan Cek Ulang)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Anomalies List */}
        {anomalies.length > 0 && (
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {anomalies.map((anomaly, idx) => (
              <div
                key={`${anomaly.recordId}-${idx}`}
                className={`p-3 rounded-xl border transition-colors ${
                  anomaly.severity === 'error'
                    ? 'bg-rose-50/40 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20'
                    : 'bg-amber-50/40 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          anomaly.severity === 'error'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {anomaly.severity === 'error' ? 'Kritis' : 'Peringatan'}
                      </span>
                      <span className="font-mono font-semibold text-xs text-[#1c1917] dark:text-white">
                        {anomaly.asset} ({anomaly.rowNumber ? `Baris ${anomaly.rowNumber}` : anomaly.recordId})
                      </span>
                      <span className="text-[11px] font-medium text-[#1c1917] dark:text-slate-200">
                        — {anomaly.title}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#57534e] dark:text-slate-400">
                      {anomaly.description}
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-500/20 mt-1">
                      <span className="font-semibold">Saran Perbaikan:</span>
                      <span>{anomaly.suggestedFix}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFixAnomaly(anomaly)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] shrink-0 transition-colors shadow-xs"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Perbaiki</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
