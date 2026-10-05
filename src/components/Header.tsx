import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { ActivePage } from '../types';
import {
  PieChart,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  ChevronDown,
  ExternalLink,
  Unlink,
  Link2,
  X,
  Check,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

interface HeaderProps {
  activePage: ActivePage;
  onSelectPage: (page: ActivePage) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  sheetConnected: boolean;
  sheetTitle: string;
  spreadsheetId: string;
  isSyncing: boolean;
  onManualSync: () => void;
  onDisconnectSheet: () => void;
  onConnectSheet: (urlOrId: string, tabName?: string) => void;
  lastSyncTime: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  onSelectPage,
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  sheetConnected,
  sheetTitle,
  spreadsheetId,
  isSyncing,
  onManualSync,
  onDisconnectSheet,
  onConnectSheet,
  lastSyncTime,
}) => {
  const [userDropdown, setUserDropdown] = useState(false);
  const [sheetDropdownOpen, setSheetDropdownOpen] = useState(false);
  const [connectPopoverOpen, setConnectPopoverOpen] = useState(false);
  const [quickInput, setQuickInput] = useState(
    spreadsheetId || '1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E'
  );
  const [quickTab, setQuickTab] = useState('INVESTMENT');
  const [customTabInput, setCustomTabInput] = useState('');

  const navItems: Array<{ id: ActivePage; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'portfolio', label: 'Rekap Investasi', icon: PieChart },
    { id: 'settings', label: 'Koneksi Sheet', icon: FileSpreadsheet },
  ];

  const handleQuickConnect = () => {
    if (!quickInput.trim()) return;
    const finalTab = quickTab === 'CUSTOM' ? (customTabInput.trim() || 'INVESTMENT') : quickTab;
    onConnectSheet(quickInput.trim(), finalTab);
    setConnectPopoverOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a0d14]/95 backdrop-blur-xl border-b border-[#1b2234] select-none text-xs shadow-lg relative">
      {/* Visual Sync Progress Shimmer Line when fetching data */}
      {isSyncing && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden bg-[#1b2234] z-50">
          <div className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 animate-pulse w-full shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Clean Typographic Branding */}
        <div className="flex items-center gap-2">
          <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
            Investment Diary
          </h1>
        </div>

        {/* Minimalist Navigation Bar */}
        <nav className="flex items-center gap-1.5 bg-[#0e1424]/80 p-1 rounded-2xl border border-[#1e273d]/80 backdrop-blur-md">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <LiquidButton
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                variant={isActive ? 'primary' : 'ghost'}
                size="sm"
                className={
                  isActive
                    ? 'font-semibold text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </LiquidButton>
            );
          })}
        </nav>

        {/* Right Section: Sync Visual Indicator / Quick Connect & Auth */}
        <div className="flex items-center gap-2">
          {/* Active Visual Indicator: Prominent Animated Spinner & Pulsing Badge during Fetch */}
          {isSyncing ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300 shrink-0" />
              <span className="font-bold text-xs tracking-tight text-cyan-200">
                <span className="hidden sm:inline">Sinkronisasi Data...</span>
                <span className="sm:hidden">Sinkron...</span>
              </span>
            </div>
          ) : sheetConnected ? (
            /* When Connected and Idle: Manual Sync Button + Status Dropdown */
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onManualSync}
                title="Sinkronkan data transaksi dari Google Sheet sekarang"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-all text-xs font-medium shadow-sm group"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 group-hover:rotate-180 transition-transform duration-300" />
                <span className="hidden md:inline">Sinkronkan</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSheetDropdownOpen(!sheetDropdownOpen);
                    setUserDropdown(false);
                    setConnectPopoverOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all shadow-sm"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span className="hidden sm:inline">Google Sheet Tersambung</span>
                  <span className="sm:hidden">Tersambung</span>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                </button>

                {sheetDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0e1424] border border-[#1e273d] shadow-2xl p-3 z-50 space-y-2 text-xs text-slate-300 animate-in fade-in zoom-in-95">
                    <div className="pb-2 border-b border-[#1b2234]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Status Koneksi</span>
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Aktif
                        </span>
                      </div>
                      <p className="font-bold text-white text-xs mt-1 truncate">Tab: {sheetTitle}</p>
                      {lastSyncTime && (
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          Sinkron: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSheetDropdownOpen(false);
                          onManualSync();
                        }}
                        disabled={isSyncing}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-all font-medium text-xs text-left"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
                        <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                      </button>

                      {spreadsheetId && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-all font-medium text-xs text-left"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <span>Buka Google Sheet di Tab Baru ↗</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSheetDropdownOpen(false);
                          onDisconnectSheet();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all font-bold text-xs text-left mt-2"
                      >
                        <Unlink className="w-3.5 h-3.5 text-rose-400" />
                        <span>Putuskan Koneksi (Disconnect)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* When Disconnected: Clean Quick Connect Button with Compact Popover */
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setConnectPopoverOpen(!connectPopoverOpen);
                  setUserDropdown(false);
                  setSheetDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/40 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md hover:shadow-blue-600/30"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Hubungkan Sheet</span>
              </button>

              {connectPopoverOpen && (
                <div className="absolute right-0 mt-2 w-84 rounded-2xl bg-[#0e1424] border border-[#1e273d] shadow-2xl p-4 z-50 space-y-3 text-xs text-left animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1b2234]">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Koneksi Cepat Google Sheet</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setConnectPopoverOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 1-Click Effortless Demo Option */}
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-400 font-medium">Link / ID Google Sheet:</label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickInput('1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E');
                        setQuickTab('INVESTMENT');
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-medium flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Pakai Sheet Demo</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={quickInput}
                      onChange={e => setQuickInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full bg-[#070a10] border border-[#1e273d] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">Pilih Tab Rekap Investasi:</label>
                    <select
                      value={quickTab}
                      onChange={e => setQuickTab(e.target.value)}
                      className="w-full bg-[#070a10] border border-[#1e273d] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="INVESTMENT">Tab: INVESTMENT (Standar Portofolio)</option>
                      <option value="Investasi">Tab: Investasi</option>
                      <option value="Portofolio">Tab: Portofolio</option>
                      <option value="Portfolio">Tab: Portfolio</option>
                      <option value="Sheet1">Tab: Sheet1</option>
                      <option value="CUSTOM">Nama Tab Lainnya (Kustom)...</option>
                    </select>

                    {quickTab === 'CUSTOM' && (
                      <input
                        type="text"
                        value={customTabInput}
                        onChange={e => setCustomTabInput(e.target.value)}
                        placeholder="Ketik nama tab persis (misal: Rekap Saham)"
                        className="w-full mt-1 bg-[#070a10] border border-[#1e273d] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickConnect}
                    disabled={!quickInput.trim() || isSyncing}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menghubungkan...' : 'Koneksikan Otomatis (Tanpa Login)'}</span>
                  </button>

                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-200 space-y-1 leading-relaxed">
                    <p className="font-semibold text-blue-300">💡 Cara Termudah (5 Detik):</p>
                    <p className="text-slate-300">
                      1. Buka spreadsheet &gt; klik <strong>"Bagikan" (Share)</strong>.<br />
                      2. Ubah akses ke <strong>"Siapa saja yang memiliki link"</strong>.<br />
                      3. Tempel link di atas &gt; Klik <strong>Koneksikan Otomatis</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Auth Dropdown */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserDropdown(!userDropdown);
                  setSheetDropdownOpen(false);
                  setConnectPopoverOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#0e1424] border border-[#1e273d] text-slate-200 hover:text-white text-xs transition-all"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="text-[11px] max-w-[80px] sm:max-w-[120px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {userDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0e1424] border border-[#1e273d] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-2 border-b border-[#1b2234] mb-1">
                    <p className="text-[11px] text-white font-semibold truncate">{user.displayName || 'Akun Google'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-all font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun Google</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative group">
              <button
                type="button"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs transition-all disabled:opacity-50"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{isLoggingIn ? 'Memproses...' : 'Sign in with Google'}</span>
              </button>
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block w-48 p-2 rounded-xl bg-[#0e1424] border border-[#1e273d] shadow-xl text-[10px] text-slate-300 z-50 pointer-events-none">
                Opsional: Anda tidak wajib login untuk merekap sheet. Cukup gunakan Hubungkan Sheet!
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

