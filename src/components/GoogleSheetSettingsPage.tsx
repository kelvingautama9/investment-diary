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
  Unlink,
  Sparkles,
} from 'lucide-react';
import {
  extractSpreadsheetId,
  listUserSpreadsheets,
  type DriveSpreadsheetFile,
} from '../services/googleSheets';
import {
  setManualAccessToken,
  activeFirebaseProjectId,
  isUsingCustomFirebase,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
} from '../services/firebaseAuth';
import { Settings2 } from 'lucide-react';
import { LiquidButton, Button } from '@/components/ui/liquid-glass-button';

interface GoogleSheetSettingsPageProps {
  spreadsheetId: string;
  onConnectSpreadsheet: (id: string, tabName?: string) => Promise<void>;
  onDisconnectSpreadsheet: () => void;
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
  onDisconnectSpreadsheet,
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
  const [selectedTab, setSelectedTab] = useState(sheetTitle || 'INVESTMENT');
  const [customTab, setCustomTab] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [byofConfigInput, setByofConfigInput] = useState('');
  const [byofError, setByofError] = useState<string | null>(null);
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

  const handleSaveByof = () => {
    setByofError(null);
    if (!byofConfigInput.trim()) return;

    // Smart detection: If user accidentally pasted their Google Sheet link here (like in image.png!)
    if (
      byofConfigInput.includes('docs.google.com') ||
      byofConfigInput.includes('spreadsheets') ||
      byofConfigInput.includes('/d/')
    ) {
      const extracted = extractSpreadsheetId(byofConfigInput);
      if (extracted) {
        setInputUrl(extracted);
        setByofConfigInput('');
        handleConnect(extracted);
        return;
      }
    }

    try {
      let cfg: any = null;
      try {
        cfg = JSON.parse(byofConfigInput);
      } catch {
        const jsonLike = byofConfigInput
          .replace(/const\s+firebaseConfig\s*=\s*/, '')
          .replace(/;?\s*$/, '')
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
          .replace(/'/g, '"');
        cfg = JSON.parse(jsonLike);
      }

      if (!cfg || !cfg.projectId) {
        const apiKey = byofConfigInput.match(/apiKey["']?\s*:\s*["']([^"']+)["']/)?.[1];
        const projectId = byofConfigInput.match(/projectId["']?\s*:\s*["']([^"']+)["']/)?.[1];
        const authDomain = byofConfigInput.match(/authDomain["']?\s*:\s*["']([^"']+)["']/)?.[1];
        const appId = byofConfigInput.match(/appId["']?\s*:\s*["']([^"']+)["']/)?.[1];
        if (projectId) {
          cfg = {
            projectId,
            apiKey: apiKey || '',
            authDomain: authDomain || `${projectId}.firebaseapp.com`,
            appId: appId || '',
          };
        }
      }

      if (cfg && cfg.projectId) {
        saveCustomFirebaseConfig(cfg);
      } else {
        setByofError('Format konfigurasi tidak valid. Pastikan memuat projectId dan apiKey.');
      }
    } catch (e: any) {
      setByofError('Gagal membaca format config: ' + e?.message);
    }
  };

  useEffect(() => {
    setInputUrl(spreadsheetId || '1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E');
  }, [spreadsheetId]);

  const handleConnect = async (targetId?: string, overrideTab?: string) => {
    const rawId = targetId || inputUrl;
    const cleanId = extractSpreadsheetId(rawId);

    if (!cleanId) {
      setIsError(true);
      setStatusMessage('Silakan masukkan URL atau ID Google Sheet yang valid.');
      return;
    }

    const tabToUse = overrideTab || (selectedTab === 'CUSTOM' ? (customTab.trim() || 'INVESTMENT') : selectedTab);

    setStatusMessage('Memeriksa Google Sheet dan memuat data transaksi...');
    setIsError(false);

    try {
      await onConnectSpreadsheet(cleanId, tabToUse);
      setStatusMessage(`Berhasil tersambung! Data transaksi dari tab "${tabToUse}" telah dimuat.`);
    } catch (err: any) {
      setIsError(true);
      if (err?.message === 'RESTRICTED_ACCESS') {
        setStatusMessage(
          'Spreadsheet Anda masih berstatus "Dibatasi" oleh Google Drive. Agar dapat dibaca otomatis tanpa login: buka Google Sheet Anda > klik Bagikan di pojok kanan atas > ubah Dibatasi menjadi "Siapa saja yang memiliki link" > klik Selesai > lalu klik Hubungkan Sheet lagi.'
        );
      } else {
        setStatusMessage(`Gagal menyambungkan: ${err?.message || 'Tidak dapat membaca spreadsheet'}`);
      }
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
            {isSyncing ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </span>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                <span>Sedang Mengambil Data...</span>
              </span>
            ) : (
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
            )}

            {sheetConnected && (
              <button
                type="button"
                onClick={onDisconnectSpreadsheet}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all shadow-sm"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Putuskan Koneksi</span>
              </button>
            )}
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

        {isError && statusMessage?.includes('Dibatasi') && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5">
            <span className="font-bold text-amber-300 block flex items-center gap-1.5">
              <span>💡 Solusi 10 Detik (Agar Terhubung Otomatis &amp; Effortless Tanpa Perlu Login):</span>
            </span>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300">
              <li>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId || '1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E'}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 font-bold underline inline-flex items-center gap-1 hover:text-blue-300"
                >
                  Klik di sini untuk buka Google Sheet Anda <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li>Klik tombol <strong>"Bagikan" (Share)</strong> di pojok kanan atas spreadsheet Anda.</li>
              <li>Pada bagian <em>Akses Umum</em>, ubah dari <strong>"Dibatasi"</strong> menjadi <strong>"Siapa saja yang memiliki link" (Anyone with the link can view)</strong>.</li>
              <li>Klik <strong>Selesai</strong>, lalu klik tombol biru <strong>"Hubungkan Sheet"</strong> di bawah!</li>
            </ol>
          </div>
        )}
      </div>

      {/* Connection Input Box */}
      <div className="p-5 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white block">
            Link Google Sheet Proyek Anda:
          </label>
          <button
            type="button"
            onClick={() => {
              setInputUrl('1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E');
              setSelectedTab('INVESTMENT');
              handleConnect('1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E', 'INVESTMENT');
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pakai Sheet Demo (1-Klik)</span>
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
            className="flex-1 bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
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

        {/* Tab Selection Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              Pilih Tab Rekap Investasi yang Ingin Dibaca:
            </label>
            <select
              value={selectedTab}
              onChange={e => setSelectedTab(e.target.value)}
              className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="INVESTMENT">Tab: INVESTMENT (Standar Portofolio)</option>
              <option value="Investasi">Tab: Investasi</option>
              <option value="Portofolio">Tab: Portofolio</option>
              <option value="Portfolio">Tab: Portfolio</option>
              <option value="Sheet1">Tab: Sheet1</option>
              <option value="CUSTOM">Nama Tab Lainnya (Kustom)...</option>
            </select>
          </div>

          {selectedTab === 'CUSTOM' && (
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">
                Ketik Nama Tab Spreadsheet Anda:
              </label>
              <input
                type="text"
                value={customTab}
                onChange={e => setCustomTab(e.target.value)}
                placeholder="Contoh: Rekap 2026, Portofolio Saham"
                className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400">
          Tempelkan link Google Sheet Anda (contohnya sheet "Monthly Spend 2026"). Web ini akan otomatis merekap transaksi investasi dan secara cerdas mengabaikan data non-investasi seperti transport/belanja harian.
        </p>

        {sheetConnected && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#1b2234]">
            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Google Sheet asli di tab baru</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                onDisconnectSpreadsheet();
                setStatusMessage('Google Sheet berhasil diputuskan. Seluruh angka direset ke 0.');
                setIsError(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all shadow-sm"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Putuskan Koneksi Google Sheet</span>
            </button>
          </div>
        )}
      </div>

      {/* Advanced Settings Accordion (Keeps page clean and effortless) */}
      <details className="p-4 rounded-2xl bg-[#10141f] border border-[#1b2234] space-y-4 group">
        <summary className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer list-none flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Pengaturan Lanjutan: Panduan Domain &amp; Token Manual (Opsional)</span>
          </span>
          <span className="text-[10px] text-blue-400 font-mono group-open:hidden">+ Buka Pengaturan</span>
        </summary>

        <div className="pt-3 space-y-4 border-t border-[#1b2234] mt-3">
          {/* Domain Authorization Helper (Vercel / GitHub Pages) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Authorized Domain (Vercel &amp; GitHub Pages)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Firebase OAuth</span>
            </div>

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
          </div>

          {/* Manual Access Token Bypass */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>Token Akses Google OAuth Manual (Bypass Login)</span>
            </span>
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
                Terapkan
              </button>
            </div>
          </div>
        </div>
      </details>

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
