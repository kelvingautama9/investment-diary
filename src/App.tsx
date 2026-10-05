import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type {
  InvestmentRecord,
  ActivePage,
  DateFilter,
} from './types';
import {
  initAuth,
  googleSignIn,
  logout as firebaseLogout,
  getAccessToken,
  activeFirebaseProjectId,
  isUsingCustomFirebase,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
} from './services/firebaseAuth';
import {
  fetchInvestmentRecords,
  appendInvestmentRecord,
  updateInvestmentRecord,
  deleteInvestmentRecordRow,
  extractSpreadsheetId,
  SHEET_NAME,
  isNonInvestmentOrExpense,
} from './services/googleSheets';

import { Header } from './components/Header';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { GoogleSheetSettingsPage } from './components/GoogleSheetSettingsPage';
import { AddEditTradeModal } from './components/AddEditTradeModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { Globe, Copy, Check, ExternalLink, AlertTriangle, X, Settings2, Key, Link2, ChevronDown, Sparkles } from 'lucide-react';

export default function App() {
  // Navigation State - only 'portfolio' and 'settings'
  const [activePage, setActivePage] = useState<ActivePage>('portfolio');

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Google Sheet Data State (Defaults to empty array and 0 metrics when disconnected)
  const [records, setRecords] = useState<InvestmentRecord[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('apex_connected_sheet_id') || '1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E';
  });
  const [sheetConnected, setSheetConnected] = useState<boolean>(false);
  const [sheetTitle, setSheetTitle] = useState<string>(SHEET_NAME);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(5);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  // Performance Date Filter
  const [dateFilter, setDateFilter] = useState<DateFilter>({ preset: 'ALL' });

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InvestmentRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<InvestmentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const addSyncLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // Initialize Auth
  useEffect(() => {
    initAuth(
      (authUser, token) => {
        setUser(authUser);
        setAccessToken(token);
        addSyncLog(`Sesi Google terautentikasi: ${authUser.email}`);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
  }, [addSyncLog]);

  // Sync with Google Sheets (Effortless: works WITH or WITHOUT Google Login)
  const syncWithGoogleSheet = useCallback(async (forcedId?: string, forcedTab?: string) => {
    const targetId = forcedId || spreadsheetId;
    if (!targetId) {
      setSheetConnected(false);
      setRecords([]);
      return;
    }

    setIsSyncing(true);
    try {
      const token = await getAccessToken();
      const tabToFetch = forcedTab || sheetTitle;
      const res = await fetchInvestmentRecords(targetId, token, tabToFetch);
      if (res && res.records && res.records.length > 0) {
        // Strictly filter out any transport or non-investment expense rows
        const cleanRecords = res.records.filter(
          r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type)
        );
        setRecords(cleanRecords);
        setSheetTitle(res.title);
        setSheetConnected(true);
        setLastSyncTime(new Date());
        addSyncLog(`Sinkronisasi berhasil: ${cleanRecords.length} transaksi dimuat dari Google Sheet (${res.title}).`);
      } else if (res) {
        setRecords([]);
        setSheetTitle(res.title);
        setSheetConnected(true);
        setLastSyncTime(new Date());
        addSyncLog(`Google Sheet terhubung tetapi tab "${res.title}" masih kosong. Angka diatur ke 0.`);
      }
    } catch (err: any) {
      console.warn('Sync warning:', err);
      setSheetConnected(false);
      setRecords([]);
      if (err?.message === 'RESTRICTED_ACCESS') {
        addSyncLog('Google Sheet masih Dibatasi. Di Google Sheet klik "Bagikan" > ubah ke "Siapa saja yang memiliki link".');
      } else {
        addSyncLog(`Sinkronisasi tertunda: ${err?.message || 'Memeriksa akses Google Sheet'}`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [spreadsheetId, sheetTitle, addSyncLog]);

  // Initial Sync on load or when spreadsheetId changes (Effortless: runs without needing login!)
  useEffect(() => {
    if (spreadsheetId) {
      syncWithGoogleSheet();
    }
  }, [spreadsheetId, syncWithGoogleSheet]);

  // Auto-sync polling
  useEffect(() => {
    if (!spreadsheetId || autoSyncInterval <= 0) return;

    const intervalMs = autoSyncInterval * 1000;
    const timer = setInterval(() => {
      syncWithGoogleSheet();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [spreadsheetId, autoSyncInterval, syncWithGoogleSheet]);

  // Connect Spreadsheet handler (Works with or without token!)
  const handleConnectSpreadsheet = async (newSheetId: string, customTabName?: string) => {
    const cleanId = extractSpreadsheetId(newSheetId);
    if (!cleanId) return;

    setSpreadsheetId(cleanId);
    if (customTabName) {
      setSheetTitle(customTabName);
    }
    localStorage.setItem('apex_connected_sheet_id', cleanId);
    addSyncLog(`ID Spreadsheet diatur ke: ${cleanId}`);

    await syncWithGoogleSheet(cleanId, customTabName);
  };

  const handleDisconnectSpreadsheet = () => {
    setSpreadsheetId('');
    localStorage.removeItem('apex_connected_sheet_id');
    setSheetConnected(false);
    setRecords([]);
    addSyncLog('Google Sheet berhasil diputuskan. Seluruh angka dan portofolio diatur ke 0.');
  };

  // Google Login / Logout
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedModalDomain, setCopiedModalDomain] = useState(false);
  const [showByofInput, setShowByofInput] = useState(false);
  const [byofConfigInput, setByofConfigInput] = useState('');
  const [byofError, setByofError] = useState<string | null>(null);

  const handleSaveByof = () => {
    setByofError(null);
    if (!byofConfigInput.trim()) return;

    // Smart detection: If user accidentally pasted their Google Sheet link here (like in screenshot)
    if (
      byofConfigInput.includes('docs.google.com') ||
      byofConfigInput.includes('spreadsheets') ||
      byofConfigInput.includes('/d/')
    ) {
      const extracted = extractSpreadsheetId(byofConfigInput);
      if (extracted) {
        setSpreadsheetId(extracted);
        localStorage.setItem('apex_connected_sheet_id', extracted);
        setShowByofInput(false);
        setByofConfigInput('');
        setUnauthorizedDomain(null);
        addSyncLog(`Link Google Sheet terdeteksi! Mengkoneksikan ke spreadsheet ${extracted}...`);
        syncWithGoogleSheet(extracted);
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

  const handleLogin = async (useRedirect = false) => {
    setIsLoggingIn(true);
    try {
      const authRes = await googleSignIn(useRedirect);
      if (authRes) {
        setUser(authRes.user);
        setAccessToken(authRes.accessToken);
        addSyncLog(`Login Google berhasil sebagai: ${authRes.user.email}`);

        if (spreadsheetId) {
          await syncWithGoogleSheet();
        }
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      const host = err?.hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
      if (
        err?.code === 'auth/unauthorized-domain' ||
        err?.message?.includes('DOMAIN_UNAUTHORIZED') ||
        err?.message?.includes('unauthorized-domain')
      ) {
        setUnauthorizedDomain(host || 'vercel.app');
      } else {
        addSyncLog(`Info Google Login: ${err?.message || 'Login dibatalkan atau terkendala'}. Anda tetap dapat membaca sheet langsung via Link Sheet tanpa perlu login.`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await firebaseLogout();
    setUser(null);
    setAccessToken(null);
    setSheetConnected(false);
    setRecords([]);
    addSyncLog('Sesi Google diakhiri. Angka dashboard direset ke 0.');
  };

  // Save Record (Add or Update)
  const handleSaveRecord = async (record: Omit<InvestmentRecord, 'rowNumber' | 'id'>) => {
    const isEdit = !!editingRecord;
    const token = await getAccessToken();

    if (sheetConnected && spreadsheetId && token) {
      if (isEdit && editingRecord.rowNumber) {
        await updateInvestmentRecord(spreadsheetId, token, sheetTitle, editingRecord.rowNumber, {
          ...record,
          id: editingRecord.id,
          rowNumber: editingRecord.rowNumber,
        });
        addSyncLog(`Memperbarui baris ${editingRecord.rowNumber} (${record.asset}) di Google Sheet.`);
      } else {
        await appendInvestmentRecord(spreadsheetId, token, sheetTitle, record);
        addSyncLog(`Menambahkan transaksi ${record.asset} ke Google Sheet tab "${sheetTitle}".`);
      }
      await syncWithGoogleSheet();
    } else {
      if (isEdit) {
        setRecords(prev =>
          prev.map(r =>
            r.id === editingRecord.id ? { ...record, id: editingRecord.id, rowNumber: editingRecord.rowNumber } : r
          )
        );
        addSyncLog(`Transaksi ${record.asset} diperbarui.`);
      } else {
        const newRowNumber = records.length + 2;
        setRecords(prev => [
          ...prev,
          { ...record, id: `ROW-${newRowNumber}`, rowNumber: newRowNumber },
        ]);
        addSyncLog(`Transaksi baru ${record.asset} ditambahkan.`);
      }
    }
  };

  // Delete Record
  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    const token = await getAccessToken();

    try {
      if (sheetConnected && spreadsheetId && token && recordToDelete.rowNumber) {
        await deleteInvestmentRecordRow(spreadsheetId, token, 0, recordToDelete.rowNumber);
        addSyncLog(`Menghapus baris ${recordToDelete.rowNumber} (${recordToDelete.asset}) dari Google Sheet.`);
        await syncWithGoogleSheet();
      } else {
        setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
        addSyncLog(`Menghapus transaksi ${recordToDelete.asset}.`);
      }
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      addSyncLog(`Gagal menghapus baris di Google Sheet: ${err?.message || 'Error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* 1. Header */}
      <Header
        activePage={activePage}
        onSelectPage={setActivePage}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        sheetConnected={sheetConnected}
        sheetTitle={sheetTitle}
        spreadsheetId={spreadsheetId}
        isSyncing={isSyncing}
        onManualSync={() => syncWithGoogleSheet()}
        onDisconnectSheet={handleDisconnectSpreadsheet}
        onConnectSheet={handleConnectSpreadsheet}
        lastSyncTime={lastSyncTime}
      />

      {/* 2. Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Page 1: Portfolio & Rekap Investasi */}
        {activePage === 'portfolio' && (
          <div className="space-y-6">
            <InvestmentDashboard
              records={records}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
            />

            <TradeLedgerTable
              records={records}
              onOpenAddModal={() => {
                setEditingRecord(null);
                setIsAddEditModalOpen(true);
              }}
              onOpenEditModal={rec => {
                setEditingRecord(rec);
                setIsAddEditModalOpen(true);
              }}
              onOpenDeleteModal={rec => {
                setRecordToDelete(rec);
                setIsDeleteModalOpen(true);
              }}
              sheetConnected={sheetConnected}
              sheetTitle={sheetTitle}
              onDisconnectSheet={handleDisconnectSpreadsheet}
              isSyncing={isSyncing}
              onManualSync={() => syncWithGoogleSheet()}
            />
          </div>
        )}

        {/* Page 2: Pengaturan Koneksi Google Sheet */}
        {activePage === 'settings' && (
          <GoogleSheetSettingsPage
            spreadsheetId={spreadsheetId}
            onConnectSpreadsheet={handleConnectSpreadsheet}
            onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
            accessToken={accessToken}
            sheetConnected={sheetConnected}
            sheetTitle={sheetTitle}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            autoSyncInterval={autoSyncInterval}
            onAutoSyncIntervalChange={setAutoSyncInterval}
            syncLogs={syncLogs}
          />
        )}
      </main>

      {/* 4. Add / Edit Trade Modal */}
      <AddEditTradeModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveRecord}
        editingRecord={editingRecord}
      />

      {/* 5. Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRecordToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        record={recordToDelete}
        sheetTitle={sheetTitle}
        isDeleting={isDeleting}
      />

      {/* 6. Unauthorized Domain Alert Modal (Compact with Dropdown Menu) */}
      {unauthorizedDomain && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#10141f] border border-[#1b2234] rounded-2xl p-5 shadow-2xl space-y-3.5 text-left select-none max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <h3 className="text-xs font-bold text-white">Login Google Terkendala Domain</h3>
              </div>
              <button
                type="button"
                onClick={() => setUnauthorizedDomain(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Effortless Recommendation Banner */}
            <div className="p-3.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-xs space-y-2">
              <span className="font-bold text-blue-300 block flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                <span>Solusi 1-Klik Paling Effortless (Tanpa Perlu Login):</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Anda <strong>tidak wajib login</strong> untuk membaca & merekap Google Sheet! Cukup buka menu <strong>Koneksi Sheet</strong>, tempel link Google Sheet Anda, dan klik <strong>Hubungkan Sheet</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setUnauthorizedDomain(null);
                  setActivePage('settings');
                }}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 mt-1"
              >
                <span>Buka Menu Koneksi Sheet Sekarang ↗</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUnauthorizedDomain(null);
                  handleConnectSpreadsheet('1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E', 'INVESTMENT');
                }}
                className="w-full py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pakai Sheet Demo (1-Klik Langsung Aktif)</span>
              </button>
            </div>

            {/* Compact Collapsible Dropdown for Advanced Settings */}
            <details className="group p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-2.5">
              <summary className="cursor-pointer font-semibold text-slate-300 flex items-center justify-between list-none select-none">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pengaturan Lanjutan Firebase (Opsional)</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>

              <div className="pt-2.5 border-t border-white/10 space-y-2.5 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Project Firebase aktif:</span>
                  <span className="font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {activeFirebaseProjectId}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Domain yang harus didaftarkan di Firebase:</span>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0b0e17] border border-[#1e273d]">
                    <code className="text-xs font-mono text-emerald-400 font-bold flex-1 truncate">
                      {unauthorizedDomain}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(unauthorizedDomain);
                        setCopiedModalDomain(true);
                        setTimeout(() => setCopiedModalDomain(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-all flex items-center gap-1 shrink-0"
                    >
                      {copiedModalDomain ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedModalDomain ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0b0e17] border border-[#1e273d] space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 block">
                    Hubungkan Project Firebase Milik Anda (BYOF):
                  </label>
                  <textarea
                    rows={3}
                    value={byofConfigInput}
                    onChange={e => setByofConfigInput(e.target.value)}
                    placeholder='{"apiKey": "...", "projectId": "...", "authDomain": "..."}'
                    className="w-full bg-[#070a10] border border-[#1e273d] rounded-xl p-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  {byofError && <p className="text-[10px] text-rose-400">{byofError}</p>}
                  <div className="flex items-center justify-between">
                    {isUsingCustomFirebase ? (
                      <button
                        type="button"
                        onClick={clearCustomFirebaseConfig}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                      >
                        Reset ke Default
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={handleSaveByof}
                      disabled={!byofConfigInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs"
                    >
                      Simpan Config
                    </button>
                  </div>
                </div>
              </div>
            </details>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setUnauthorizedDomain(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold transition-all"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnauthorizedDomain(null);
                  handleLogin(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Coba Login Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
