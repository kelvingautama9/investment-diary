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
  SHEET_NAME,
} from './services/googleSheets';

import { Header } from './components/Header';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { GoogleSheetSettingsPage } from './components/GoogleSheetSettingsPage';
import { AIPopupChatbot } from './components/AIPopupChatbot';
import { AddEditTradeModal } from './components/AddEditTradeModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { Globe, Copy, Check, ExternalLink, AlertTriangle, X, Settings2, Key } from 'lucide-react';

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
    return localStorage.getItem('apex_connected_sheet_id') || '';
  });
  const [sheetConnected, setSheetConnected] = useState<boolean>(false);
  const [sheetTitle, setSheetTitle] = useState<string>(SHEET_NAME);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(5);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  // Performance Date Filter
  const [dateFilter, setDateFilter] = useState<DateFilter>({ preset: 'ALL' });

  // Sound & Push Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

  // Sync with Google Sheets
  const syncWithGoogleSheet = useCallback(async () => {
    if (!spreadsheetId) {
      setSheetConnected(false);
      setRecords([]);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setSheetConnected(false);
      setRecords([]);
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetchInvestmentRecords(spreadsheetId, token);
      if (res && res.records && res.records.length > 0) {
        setRecords(res.records);
        setSheetTitle(res.title);
        setSheetConnected(true);
        setLastSyncTime(new Date());
        addSyncLog(`Sinkronisasi berhasil: ${res.records.length} transaksi dimuat dari Google Sheet.`);
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
      addSyncLog(`Sinkronisasi tertunda: ${err?.message || 'Memeriksa akses Google Sheet'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [spreadsheetId, addSyncLog]);

  // Initial Sync when token or spreadsheetId changes
  useEffect(() => {
    if (accessToken && spreadsheetId) {
      syncWithGoogleSheet();
    }
  }, [accessToken, spreadsheetId, syncWithGoogleSheet]);

  // Auto-sync polling
  useEffect(() => {
    if (!accessToken || !spreadsheetId || autoSyncInterval <= 0) return;

    const intervalMs = autoSyncInterval * 1000;
    const timer = setInterval(() => {
      syncWithGoogleSheet();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [accessToken, spreadsheetId, autoSyncInterval, syncWithGoogleSheet]);

  // Connect Spreadsheet handler
  const handleConnectSpreadsheet = async (newSheetId: string) => {
    setSpreadsheetId(newSheetId);
    localStorage.setItem('apex_connected_sheet_id', newSheetId);
    addSyncLog(`ID Spreadsheet diatur ke: ${newSheetId}`);

    const token = await getAccessToken();
    if (token) {
      setIsSyncing(true);
      try {
        const res = await fetchInvestmentRecords(newSheetId, token);
        if (res && res.records) {
          setRecords(res.records);
          setSheetTitle(res.title);
          setSheetConnected(true);
          setLastSyncTime(new Date());
          addSyncLog(`Berhasil terhubung ke Google Sheet. Memuat ${res.records.length} data posisi.`);
        }
      } catch (err: any) {
        addSyncLog(`Error menghubungkan sheet: ${err?.message || 'Akses ditolak'}`);
        alert('Gagal menghubungkan Google Sheet. Pastikan ID valid dan izin telah diberikan.');
      } finally {
        setIsSyncing(false);
      }
    }
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
        alert('Gagal Sign in Google: ' + (err?.message || 'Error'));
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
      alert('Gagal menghapus baris: ' + (err?.message || 'Error'));
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
        onManualSync={syncWithGoogleSheet}
        lastSyncTime={lastSyncTime}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        notificationsEnabled={notificationsEnabled}
        setNotificationsEnabled={setNotificationsEnabled}
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
            />
          </div>
        )}

        {/* Page 2: Pengaturan Koneksi Google Sheet */}
        {activePage === 'settings' && (
          <GoogleSheetSettingsPage
            spreadsheetId={spreadsheetId}
            onConnectSpreadsheet={handleConnectSpreadsheet}
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

      {/* 3. Floating Popup AI Assistant */}
      <AIPopupChatbot
        records={records}
        activeSignal={null}
        sheetTitle={sheetTitle}
      />

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

      {/* 6. Unauthorized Domain Alert Modal (Vercel / GitHub Pages) */}
      {unauthorizedDomain && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-[#10141f] border border-[#1b2234] rounded-2xl p-6 shadow-2xl space-y-4 text-left select-none">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-white">Domain Belum Diizinkan di Firebase Console</h3>
              </div>
              <button
                type="button"
                onClick={() => setUnauthorizedDomain(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Google memblokir login OAuth karena domain website Anda saat ini (<strong>Vercel / GitHub Pages</strong>) belum didaftarkan ke daftar <em>Authorized Domains</em> di Firebase Console.
            </p>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-slate-400">Project Firebase aktif web ini:</span>
              <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {activeFirebaseProjectId}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 block">Domain yang harus didaftarkan:</span>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0b0e17] border border-[#1e273d]">
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
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  {copiedModalDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedModalDomain ? 'Tersalin!' : 'Salin Domain'}</span>
                </button>
              </div>
            </div>

            {/* Why not changed explanation */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <span>Sudah add domain tapi status tidak berubah?</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Jika Anda menambahkan domain ini ke <strong>Project Firebase milik Anda sendiri</strong> (berbeda dari <code>{activeFirebaseProjectId}</code>), masukkan konfigurasi Firebase Anda di bawah ini agar web terhubung ke project Anda:
              </p>
            </div>

            {/* Expandable BYOF Form */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowByofInput(!showByofInput)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{showByofInput ? 'Tutup Form Konfigurasi Firebase' : 'Hubungkan Project Firebase Milik Anda Sendiri (BYOF)'}</span>
              </button>

              {showByofInput && (
                <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#1e273d] space-y-2 text-xs">
                  <label className="text-[11px] font-semibold text-slate-400 block">
                    Tempel Config Firebase Web (dari Firebase Console &gt; Project Settings &gt; General &gt; Your Apps):
                  </label>
                  <textarea
                    rows={4}
                    value={byofConfigInput}
                    onChange={e => setByofConfigInput(e.target.value)}
                    placeholder='{"apiKey": "AIzaSy...", "authDomain": "my-app.firebaseapp.com", "projectId": "my-app", "appId": "..."}'
                    className="w-full bg-[#070a10] border border-[#1e273d] rounded-xl p-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  {byofError && <p className="text-[11px] text-rose-400">{byofError}</p>}
                  <div className="flex items-center justify-between pt-1">
                    {isUsingCustomFirebase ? (
                      <button
                        type="button"
                        onClick={clearCustomFirebaseConfig}
                        className="text-xs text-rose-400 hover:text-rose-300 underline"
                      >
                        Reset ke Project Default
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={handleSaveByof}
                      disabled={!byofConfigInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md"
                    >
                      Terapkan Project Saya
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 space-y-2">
              <span className="font-semibold text-blue-300 block">Langkah di Firebase Console:</span>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-300">
                <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 underline font-semibold inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-2.5 h-2.5 inline" /></a> &gt; Pilih proyek Anda.</li>
                <li>Masuk ke menu <strong>Authentication</strong> &gt; Tab <strong>Settings</strong> &gt; Gulir ke <strong>Authorized Domains</strong>.</li>
                <li>Klik <strong>Add Domain</strong>, tempelkan domain Anda di atas (<code>{unauthorizedDomain}</code>), lalu klik <strong>Save</strong>.</li>
              </ol>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setUnauthorizedDomain(null);
                  setActivePage('settings');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Gunakan Token Manual di Pengaturan
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLogin(true)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-all"
                  title="Coba redirect jika popup diblokir"
                >
                  Coba Redirect
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnauthorizedDomain(null);
                    handleLogin(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
                >
                  Coba Login Lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
