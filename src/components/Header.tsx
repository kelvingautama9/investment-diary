import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { ActivePage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { usePrivacy } from '../context/PrivacyContext';
import {
  LayoutDashboard,
  Grid3X3,
  Table,
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
  Menu,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Calculator,
  Coins,
  AlertTriangle,
  SlidersHorizontal,
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
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onOpenRiskCalculator?: () => void;
  onOpenDividends?: () => void;
  onOpenSanitizer?: () => void;
  anomalyCount?: number;
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
  onToggleSidebar,
  isSidebarCollapsed,
  onOpenRiskCalculator,
  onOpenDividends,
  onOpenSanitizer,
  anomalyCount = 0,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [sheetDropdownOpen, setSheetDropdownOpen] = useState(false);
  const [connectPopoverOpen, setConnectPopoverOpen] = useState(false);
  const [quickInput, setQuickInput] = useState(
    spreadsheetId || '1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E'
  );
  const [quickTab, setQuickTab] = useState('INVESTMENT');
  const [customTabInput, setCustomTabInput] = useState('');

  const navItems: Array<{ id: ActivePage; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'heatmap', label: 'Peta Aset', icon: Grid3X3 },
    { id: 'ledger', label: 'Database', icon: Table },
    { id: 'settings', label: 'Koneksi Sheet', icon: FileSpreadsheet },
  ];

  const handleQuickConnect = () => {
    if (!quickInput.trim()) return;
    const finalTab = quickTab === 'CUSTOM' ? (customTabInput.trim() || 'INVESTMENT') : quickTab;
    onConnectSheet(quickInput.trim(), finalTab);
    setConnectPopoverOpen(false);
  };

  const normalizedActivePage = activePage === 'portfolio' ? 'overview' : activePage;

  return (
    <header className="sticky top-0 z-40 bg-[#fcfbfa] dark:bg-[#080a0f] border-b border-[#e5e0d5] dark:border-[#1a2233] text-xs transition-colors duration-200">
      {/* Subtle sync progress line */}
      {isSyncing && (
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-blue-600 dark:bg-blue-500 animate-pulse z-50" />
      )}

      <div className="w-full px-3 sm:px-4 h-12 flex items-center justify-between gap-2.5">
        {/* Zone 1: Sidebar Toggle & Brand */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? 'Tampilkan Sidebar' : 'Sembunyikan Sidebar'}
              className="p-1.5 rounded-md text-[#6e685f] hover:text-[#1c1917] hover:bg-[#efebe2] dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#161d2d] transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <span className="font-semibold text-xs tracking-tight text-[#1c1917] dark:text-white whitespace-nowrap">
            Investment Diary
          </span>
        </div>

        {/* Zone 2: Navigation Links (Clean Multi-Page Segmented Tab Strip in Flex Flow - NO OVERLAP) */}
        <nav className="hidden md:flex items-center gap-0.5 bg-[#efebe2] dark:bg-[#0c0f17] p-0.5 rounded-md border border-[#ded8cb] dark:border-[#1a2233] shrink-0">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = normalizedActivePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPage(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#ffffff] text-[#1c1917] shadow-xs border border-[#ded8cb] dark:border-transparent dark:bg-[#182030] dark:text-white'
                    : 'text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-[#8a8377] dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Consolidated Header Actions (Clean, Zero Collision) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
          {/* Quick Tools Dropdown (Kalkulator Risiko, Dividen, Pemeriksa Anomali) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setToolsDropdownOpen(!toolsDropdownOpen);
                setSheetDropdownOpen(false);
                setUserDropdown(false);
                setConnectPopoverOpen(false);
              }}
              title="Peralatan Portofolio & Manajemen Risiko"
              className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center relative shadow-xs ${
                toolsDropdownOpen || anomalyCount > 0
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-[#ded8cb] dark:border-[#232d42] bg-[#ffffff] dark:bg-[#101520] hover:bg-[#f7f5ef] dark:hover:bg-[#161d2c] text-[#57534e] dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {anomalyCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center font-mono ring-1 ring-white dark:ring-[#0c0f17]">
                  {anomalyCount}
                </span>
              )}
            </button>

            {toolsDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#ffffff] dark:bg-[#0f131c] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-2 z-50 text-xs text-[#292524] dark:text-slate-300 space-y-1">
                <div className="px-2.5 py-1.5 border-b border-[#e5e0d5] dark:border-[#1a2233] text-[10px] uppercase font-bold text-[#8a8377] tracking-wider">
                  Peralatan Portofolio
                </div>

                {onOpenRiskCalculator && (
                  <button
                    type="button"
                    onClick={() => {
                      setToolsDropdownOpen(false);
                      onOpenRiskCalculator();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#f7f5ef] dark:hover:bg-[#182030] text-left transition-colors"
                  >
                    <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <div className="font-medium text-[#1c1917] dark:text-white">Kalkulator Risiko</div>
                      <div className="text-[10px] text-[#8a8377]">Hitung sizing & batas risiko</div>
                    </div>
                  </button>
                )}

                {onOpenDividends && (
                  <button
                    type="button"
                    onClick={() => {
                      setToolsDropdownOpen(false);
                      onOpenDividends();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#f7f5ef] dark:hover:bg-[#182030] text-left transition-colors"
                  >
                    <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="font-medium text-[#1c1917] dark:text-white">Pencatatan Dividen</div>
                      <div className="text-[10px] text-[#8a8377]">Rekap dividen & aksi korporasi</div>
                    </div>
                  </button>
                )}

                {anomalyCount > 0 && onOpenSanitizer && (
                  <button
                    type="button"
                    onClick={() => {
                      setToolsDropdownOpen(false);
                      onOpenSanitizer();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-left transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold">{anomalyCount} Anomali Terdeteksi</div>
                      <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80">Periksa & perbaiki baris anomali</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Privacy Mode (Hide Balances) Toggle */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? 'Mode Privasi Aktif' : 'Sembunyikan Saldo Nominal'}
            className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center shadow-xs ${
              isPrivacyMode
                ? 'border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                : 'border-[#ded8cb] dark:border-[#232d42] bg-[#ffffff] dark:bg-[#101520] hover:bg-[#f7f5ef] dark:hover:bg-[#161d2c] text-[#57534e] dark:text-slate-300'
            }`}
          >
            {isPrivacyMode ? (
              <EyeOff className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            className="p-1.5 rounded-lg border border-[#ded8cb] dark:border-[#232d42] bg-[#ffffff] dark:bg-[#101520] hover:bg-[#f7f5ef] dark:hover:bg-[#161d2c] text-[#57534e] dark:text-slate-300 hover:text-[#1c1917] dark:hover:text-white transition-colors flex items-center justify-center shadow-xs"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-700" />
            )}
          </button>

          {/* Connected vs Disconnected State Pill */}
          {sheetConnected ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSheetDropdownOpen(!sheetDropdownOpen);
                  setUserDropdown(false);
                  setToolsDropdownOpen(false);
                  setConnectPopoverOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors whitespace-nowrap shadow-2xs"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500 dark:bg-emerald-400'
                  }`}
                />
                <span className="hidden sm:inline">
                  {isSyncing ? 'Sinkron...' : 'Terhubung'}
                </span>
                <ChevronDown className="w-3 h-3 text-emerald-700 dark:text-emerald-400 ml-0.5" />
              </button>

                {sheetDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#ffffff] dark:bg-[#0f131c] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-3 z-50 space-y-2.5 text-xs text-[#292524] dark:text-slate-300">
                    <div className="pb-2.5 border-b border-[#e5e0d5] dark:border-[#1a2233]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#6e685f] dark:text-slate-400">Status Database</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Tersambung</span>
                      </div>
                      <p className="font-semibold text-[#1c1917] dark:text-white mt-1 truncate">Tab: {sheetTitle}</p>
                      {lastSyncTime && (
                        <p className="text-[11px] text-[#8a8377] dark:text-slate-500 mt-0.5 font-mono">
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f7f5ef] dark:hover:bg-[#182030] text-[#1c1917] dark:text-slate-200 transition-colors text-left"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-[#8a8377] dark:text-slate-400'}`} />
                        <span>Sinkronkan Sekarang</span>
                      </button>

                      {spreadsheetId && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f7f5ef] dark:hover:bg-[#182030] text-[#1c1917] dark:text-slate-200 transition-colors text-left"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#8a8377] dark:text-slate-400" />
                          <span>Buka Google Sheet Asli ↗</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSheetDropdownOpen(false);
                          onDisconnectSheet();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium text-left mt-1"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Putuskan Koneksi</span>
                      </button>
                    </div>
                  </div>
                )}
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
                <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-xl bg-[#ffffff] dark:bg-[#0f131c] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-4 z-50 space-y-3.5 text-xs text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e5e0d5] dark:border-[#1a2233]">
                    <span className="font-semibold text-[#1c1917] dark:text-white">Hubungkan Google Sheet</span>
                    <button
                      type="button"
                      onClick={() => setConnectPopoverOpen(false)}
                      className="text-[#6e685f] hover:text-[#1c1917] dark:text-slate-400 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[#6e685f] dark:text-slate-400 text-[11px] font-medium">Link atau ID Spreadsheet:</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickInput('1zHROHuGIcJm63bpVLpJoaIXmp00gHRdR6Sc2nf_E_7E');
                          setQuickTab('INVESTMENT');
                        }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Gunakan Sheet Demo
                      </button>
                    </div>
                    <input
                      type="text"
                      value={quickInput}
                      onChange={e => setQuickInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full bg-[#f7f5ef] dark:bg-[#080a0f] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#6e685f] dark:text-slate-400 text-[11px] font-medium">Pilih Tab Rekap Investasi:</label>
                    <select
                      value={quickTab}
                      onChange={e => setQuickTab(e.target.value)}
                      className="w-full bg-[#f7f5ef] dark:bg-[#080a0f] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-slate-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500"
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
                        className="w-full mt-1 bg-[#f7f5ef] dark:bg-[#080a0f] border border-[#ded8cb] dark:border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-[#1c1917] dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-blue-500"
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

                  <div className="p-2.5 rounded-lg bg-[#f7f5ef] dark:bg-[#080a0f] border border-[#e5e0d5] dark:border-[#1a2233] text-[11px] text-[#6e685f] dark:text-slate-400 space-y-1">
                    <p className="font-semibold text-[#1c1917] dark:text-slate-300">Panduan Akses Spreadsheet:</p>
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
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#ffffff] dark:bg-[#101520] border border-[#ded8cb] dark:border-[#1e2638] text-[#1c1917] dark:text-slate-200 hover:text-black dark:hover:text-white text-xs transition-colors shadow-xs"
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
                <ChevronDown className="w-3 h-3 text-[#8a8377] dark:text-slate-400" />
              </button>

              {userDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#ffffff] dark:bg-[#0f131c] border border-[#ded8cb] dark:border-[#1e2638] shadow-2xl p-2 z-50 text-xs">
                  <div className="px-2.5 py-2 border-b border-[#e5e0d5] dark:border-[#1a2233] mb-1">
                    <p className="font-semibold text-[#1c1917] dark:text-white truncate">{user.displayName || 'Akun Google'}</p>
                    <p className="text-[11px] text-[#6e685f] dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium text-left"
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
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#ded8cb] dark:border-[#232d42] bg-[#ffffff] dark:bg-[#101520] hover:bg-[#f7f5ef] dark:hover:bg-[#161d2c] text-[#44403c] dark:text-slate-300 hover:text-[#1c1917] dark:hover:text-white text-xs transition-colors disabled:opacity-50 shadow-xs"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#8a8377] dark:text-slate-400" />
              <span>{isLoggingIn ? 'Memproses...' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Android-ready ergonomic bottom tab bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#ffffff]/95 dark:bg-[#0c0f17]/95 backdrop-blur-md border-t border-[#ded8cb] dark:border-[#1a2233] py-1 px-2 flex items-center justify-around shadow-lg safe-bottom">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = normalizedActivePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPage(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-lg transition-colors flex-1 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-[#6e685f] dark:text-slate-400 hover:text-[#1c1917]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-[#8a8377] dark:text-slate-400'}`} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};

