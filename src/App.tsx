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
} from './services/firebaseAuth';
import {
  fetchInvestmentRecords,
  appendInvestmentRecord,
  updateInvestmentRecord,
  deleteInvestmentRecordRow,
  INITIAL_SAMPLE_RECORDS,
  SHEET_NAME,
} from './services/googleSheets';

import { Header } from './components/Header';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { GoogleSheetSettingsPage } from './components/GoogleSheetSettingsPage';
import { AIPopupChatbot } from './components/AIPopupChatbot';
import { AddEditTradeModal } from './components/AddEditTradeModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';

export default function App() {
  // Navigation State - only 'portfolio' and 'settings'
  const [activePage, setActivePage] = useState<ActivePage>('portfolio');

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Google Sheet Data State
  const [records, setRecords] = useState<InvestmentRecord[]>(INITIAL_SAMPLE_RECORDS);
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
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setSheetConnected(false);
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
        setSheetTitle(res.title);
        setSheetConnected(true);
        setLastSyncTime(new Date());
        addSyncLog(`Google Sheet terhubung tetapi tab "${res.title}" masih kosong.`);
      }
    } catch (err: any) {
      console.warn('Sync warning:', err);
      setSheetConnected(false);
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
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const authRes = await googleSignIn();
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
      alert('Gagal Sign in Google: ' + (err?.message || 'Error'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await firebaseLogout();
    setUser(null);
    setAccessToken(null);
    setSheetConnected(false);
    addSyncLog('Sesi Google diakhiri.');
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
    </div>
  );
}
