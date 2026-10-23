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
  User as UserIcon,
  Check,
} from 'lucide-react';

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
    <header className="sticky top-0 z-40 bg-[#080a0f] border-b border-[#1a2233] text-xs">
      {/* Subtle sync progress line */}
      {isSyncing && (
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-blue-500 animate-pulse z-50" />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Clean Typography Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#141a27] border border-[#232d42] flex items-center justify-center text-blue-400 font-bold text-xs">
            ID
          </div>
          <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
            Investment Diary
          </span>
        </div>

        {/* Zone 2: Navigation Links (Clean Segmented Tab Strip) */}
        <nav className="flex items-center gap-1 bg-[#0d111a] p-1 rounded-lg border border-[#1a2233]">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPage(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#182030] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Sync & Connection Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Syncing State */}
          {isSyncing ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111622] border border-[#1e273a] text-slate-300 text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
              <span className="hidden sm:inline font-medium">Sinkronisasi data...</span>
              <span className="sm:hidden font-medium">Sinkron...</span>
            </div>
          ) : sheetConnected ? (
            /* Connected State: Refresh Button + Connection Details Dropdown */
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onManualSync}
                title="Sinkronkan data dari Google Sheet sekarang"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#232d42] bg-[#101520] hover:bg-[#161d2c] text-slate-300 hover:text-white transition-colors text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
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
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-900/60 bg-emerald-950/30 text-emerald-300 text-xs font-medium hover:bg-emerald-950/50 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="hidden sm:inline">Google Sheet Terhubung</span>
                  <span className="sm:hidden">Terhubung</span>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                </button>

                {sheetDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0f131c] border border-[#1e2638] shadow-2xl p-3 z-50 space-y-2.5 text-xs text-slate-300">
                    <div className="pb-2.5 border-b border-[#1a2233]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Status Database</span>
                        <span className="text-emerald-400 font-semibold">Tersambung</span>
                      </div>
                      <p className="font-semibold text-white mt-1 truncate">Tab: {sheetTitle}</p>
                      {lastSyncTime && (
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          Pembaruan: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#182030] text-slate-200 transition-colors text-left"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sinkronkan Sekarang</span>
                      </button>

                      {spreadsheetId && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#182030] text-slate-200 transition-colors text-left"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          <span>Buka Google Sheet Asli ↗</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSheetDropdownOpen(false);
                          onDisconnectSheet();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-950/30 transition-colors font-medium text-left mt-1"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Putuskan Koneksi</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Disconnected State: Clean Connect Button */
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setConnectPopoverOpen(!connectPopoverOpen);
                  setUserDropdown(false);
                  setSheetDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Hubungkan Sheet</span>
              </button>

              {connectPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-xl bg-[#0f131c] border border-[#1e2638] shadow-2xl p-4 z-50 space-y-3.5 text-xs text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1a2233]">
                    <span className="font-semibold text-white">Hubungkan Google Sheet</span>
                    <button
                      type="button"
                      onClick={() => setConnectPopoverOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-400 text-[11px] font-medium">Link atau ID Spreadsheet:</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickInput('1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E');
                          setQuickTab('INVESTMENT');
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                      >
                        Gunakan Sheet Demo
                      </button>
                    </div>
                    <input
                      type="text"
                      value={quickInput}
                      onChange={e => setQuickInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full bg-[#080a0f] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[11px] font-medium">Pilih Tab Rekap Investasi:</label>
                    <select
                      value={quickTab}
                      onChange={e => setQuickTab(e.target.value)}
                      className="w-full bg-[#080a0f] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="INVESTMENT">Tab: INVESTMENT (Standar)</option>
                      <option value="Investasi">Tab: Investasi</option>
                      <option value="Portofolio">Tab: Portofolio</option>
                      <option value="Portfolio">Tab: Portfolio</option>
                      <option value="Sheet1">Tab: Sheet1</option>
                      <option value="CUSTOM">Nama Tab Kustom...</option>
                    </select>

                    {quickTab === 'CUSTOM' && (
                      <input
                        type="text"
                        value={customTabInput}
                        onChange={e => setCustomTabInput(e.target.value)}
                        placeholder="Ketik nama tab persis (misal: Rekap Saham)"
                        className="w-full mt-1 bg-[#080a0f] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickConnect}
                    disabled={!quickInput.trim() || isSyncing}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menghubungkan...' : 'Koneksikan Sekarang'}</span>
                  </button>

                  <div className="p-2.5 rounded-lg bg-[#080a0f] border border-[#1a2233] text-[11px] text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-300">Panduan Akses Spreadsheet:</p>
                    <p className="leading-relaxed">
                      Di Google Sheet, klik <strong>Bagikan (Share)</strong>, lalu ubah Akses Umum menjadi <strong>Siapa saja yang memiliki link</strong> agar data dapat dibaca langsung tanpa login.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile / Google Sign-in */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserDropdown(!userDropdown);
                  setSheetDropdownOpen(false);
                  setConnectPopoverOpen(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#101520] border border-[#1e2638] text-slate-200 hover:text-white text-xs transition-colors"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="text-xs max-w-[90px] truncate hidden sm:inline">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {userDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f131c] border border-[#1e2638] shadow-2xl p-2 z-50 text-xs">
                  <div className="px-2.5 py-2 border-b border-[#1a2233] mb-1">
                    <p className="font-semibold text-white truncate">{user.displayName || 'Akun Google'}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-rose-400 hover:bg-rose-950/30 transition-colors font-medium text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun Google</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#232d42] bg-[#101520] hover:bg-[#161d2c] text-slate-300 hover:text-white text-xs transition-colors disabled:opacity-50"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>{isLoggingIn ? 'Memproses...' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
