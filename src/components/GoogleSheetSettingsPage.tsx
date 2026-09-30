import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Link,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ExternalLink,
  Clock,
  ShieldCheck,
  Globe,
  Copy,
  Check,
  Key,
} from 'lucide-react';
import {
  extractSpreadsheetId,
  listUserSpreadsheets,
  type DriveSpreadsheetFile,
} from '../services/googleSheets';
import { setManualAccessToken } from '../services/firebaseAuth';
import { LiquidButton, Button } from '@/components/ui/liquid-glass-button';

interface GoogleSheetSettingsPageProps {
  spreadsheetId: string;
  onConnectSpreadsheet: (id: string) => Promise<void>;
  accessToken: string | null;
  sheetConnected: boolean;
  sheetTitle: string;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  autoSyncInterval: number;
  onAutoSyncIntervalChange: (sec: number) => void;
  syncLogs: string[];
}

export const GoogleSheetSettingsPage: React.FC<GoogleSheetSettingsPageProps> = ({
  spreadsheetId,
  onConnectSpreadsheet,
  accessToken,
  sheetConnected,
  sheetTitle,
  isSyncing,
  lastSyncTime,
  autoSyncInterval,
  onAutoSyncIntervalChange,
  syncLogs,
}) => {
  const [inputUrl, setInputUrl] = useState(spreadsheetId);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyDomain = () => {
    if (currentHostname) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    }
  };

  const handleApplyManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    setManualAccessToken(manualTokenInput.trim());
    setStatusMessage('Token Google OAuth manual berhasil disimpan! Mencoba sinkronisasi...');
    setIsError(false);
    if (spreadsheetId) {
      await onConnectSpreadsheet(spreadsheetId);
    }
  };

  useEffect(() => {
    setInputUrl(spreadsheetId);
  }, [spreadsheetId]);

  const handleConnect = async (targetId?: string) => {
    const rawId = targetId || inputUrl;
    const cleanId = extractSpreadsheetId(rawId);

    if (!cleanId) {
      setIsError(true);
      setStatusMessage('Silakan masukkan URL atau ID Google Sheet yang valid.');
      return;
    }

    setStatusMessage('Memeriksa Google Sheet dan memverifikasi tab INVESTMENT...');
    setIsError(false);

    try {
      await onConnectSpreadsheet(cleanId);
      setStatusMessage(`Berhasil tersambung! Tab "${sheetTitle}" telah tersinkronisasi dua arah secara real-time.`);
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(`Gagal menyambungkan: ${err?.message || 'Tidak dapat membaca spreadsheet'}`);
    }
  };

  const handleFetchDriveFiles = async () => {
    if (!accessToken) {
      setIsError(true);
      setStatusMessage('Silakan Sign in with Google terlebih dahulu untuk melihat spreadsheet Drive Anda.');
      return;
    }

    setIsLoadingDrive(true);
    setStatusMessage('Memuat daftar spreadsheet dari Google Drive Anda...');
    try {
      const files = await listUserSpreadsheets(accessToken);
      setDriveFiles(files);
      if (files.length === 0) {
        setStatusMessage('Tidak ada spreadsheet ditemukan di Drive Anda.');
      } else {
        setStatusMessage(`Ditemukan ${files.length} spreadsheet dari Google Drive.`);
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage('Gagal membaca Google Drive: ' + err.message);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 select-none">
      {/* Status Card */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Integrasi Google Sheet Dua Arah
              </h2>
              <p className="text-xs text-slate-400">
                Fokus sinkronisasi pada database tab: <strong className="text-blue-400">"{sheetTitle}"</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                sheetConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${sheetConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{sheetConnected ? 'Tersinkronisasi' : 'Belum Tersambung'}</span>
            </span>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              isError
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Connection Input Box */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3">
        <label className="text-xs font-semibold text-white block">
          Link Google Sheet Proyek Anda:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
            className="flex-1 bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
          />
          <LiquidButton
            onClick={() => handleConnect()}
            disabled={isSyncing}
            variant="primary"
            size="md"
            className="px-5 py-2.5 rounded-xl font-bold gap-2 shadow-[0_4px_20px_rgba(37,99,235,0.4)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menghubungkan...' : 'Hubungkan Sheet'}</span>
          </LiquidButton>
        </div>
        <p className="text-[11px] text-slate-400">
          Tempelkan link proyek Google Sheet Anda (contohnya sheet "Monthly Spend 2026"). Web ini akan otomatis membaca dan merekap data pada tab <strong>INVESTMENT</strong>.
        </p>

        {spreadsheetId && (
          <div className="pt-2">
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Google Sheet asli di tab baru</span>
            </a>
          </div>
        )}
      </div>

      {/* Domain Authorization Helper (Vercel / GitHub Pages) */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Panduan Domain Login (Vercel & GitHub Pages)</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Firebase OAuth Authorized Domain</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Jika saat klik <strong>"Sign in with Google"</strong> muncul pesan domain belum diizinkan atau login gagal, daftarkan domain website Anda saat ini ke Firebase Console:
        </p>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0b0e17] border border-[#1e273d]">
          <span className="text-[11px] text-slate-400">Domain saat ini:</span>
          <code className="text-xs font-mono text-emerald-400 font-bold flex-1 truncate">
            {currentHostname || 'localhost'}
          </code>
          <button
            type="button"
            onClick={handleCopyDomain}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-all flex items-center gap-1"
          >
            {copiedDomain ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedDomain ? 'Tersalin' : 'Salin Domain'}</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 space-y-1 pl-1">
          <div>1. Buka <strong>Firebase Console</strong> &gt; Proyek Anda &gt; <strong>Authentication</strong> &gt; tab <strong>Settings</strong>.</div>
          <div>2. Gulir ke bawah ke bagian <strong>Authorized Domains</strong> &gt; Klik <strong>Add Domain</strong>.</div>
          <div>3. Tempelkan domain Anda di atas (<code>{currentHostname || 'vercel.app'}</code>) lalu klik Simpan.</div>
        </div>
      </div>

      {/* Manual Access Token Bypass */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">Atau Gunakan Google Access Token Manual</h3>
          </div>
          <span className="text-[10px] text-blue-400 font-mono">Bypass Login Popup</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Jika browser Anda memblokir popup Google atau belum sempat menambahkan Authorized Domain di Firebase Console, Anda dapat menempelkan Google Access Token langsung:
        </p>

        <div className="flex gap-2">
          <input
            type="password"
            value={manualTokenInput}
            onChange={e => setManualTokenInput(e.target.value)}
            placeholder="ya29.a0AfH6SM..."
            className="flex-1 bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="button"
            onClick={handleApplyManualToken}
            disabled={!manualTokenInput.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md"
          >
            Terapkan Token
          </button>
        </div>
      </div>

      {/* Select from Google Drive */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white">Pilih dari Google Drive Anda</h3>
            <p className="text-[11px] text-slate-400">Jelajahi spreadsheet akun Google yang sedang aktif</p>
          </div>
          <LiquidButton
            onClick={handleFetchDriveFiles}
            disabled={isLoadingDrive || !accessToken}
            variant="secondary"
            size="sm"
            className="px-3.5 py-1.5 rounded-xl text-xs disabled:opacity-40"
          >
            {isLoadingDrive ? 'Mencari...' : 'Cari Spreadsheet'}
          </LiquidButton>
        </div>

        {driveFiles.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pt-2 border-t border-[#1b2234]">
            {driveFiles.map(file => (
              <div
                key={file.id}
                onClick={() => {
                  setInputUrl(file.id);
                  handleConnect(file.id);
                }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#0b0e17] hover:bg-[#182136] border border-[#1e273d] cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-white text-xs font-medium truncate">{file.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(file.modifiedTime).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-time Heartbeat Interval */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">Interval Sinkronisasi Otomatis</h3>
          </div>
          <span className="text-xs text-slate-400">
            Terakhir Sinkron: <strong>{lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Belum'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { sec: 5, label: '5 Detik (Real-time)' },
            { sec: 10, label: '10 Detik' },
            { sec: 30, label: '30 Detik' },
            { sec: 0, label: 'Manual Saja' },
          ].map(opt => (
            <button
              key={opt.sec}
              onClick={() => onAutoSyncIntervalChange(opt.sec)}
              className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                autoSyncInterval === opt.sec
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-600/30'
                  : 'bg-[#0b0e17] border-[#1e273d] text-slate-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Telemetry Logs */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-2">
        <span className="text-xs font-bold text-white block">Log Aktivitas Sinkronisasi Dua Arah</span>
        <div className="bg-[#0b0e17] p-3 rounded-xl border border-[#1e273d] h-32 overflow-y-auto no-scrollbar font-mono text-[11px] text-slate-400 space-y-1">
          {syncLogs.length === 0 ? (
            <div className="text-slate-600">Belum ada riwayat aktivitas sinkronisasi.</div>
          ) : (
            syncLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold">›</span>
                <span className="text-slate-300">{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
