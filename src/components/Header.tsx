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
  ShieldCheck,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playTerminalChime, requestNotificationPermission } from '../services/notificationService';
import { LiquidButton, Button } from '@/components/ui/liquid-glass-button';

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
  lastSyncTime: Date | null;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
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
  lastSyncTime,
  soundEnabled,
  setSoundEnabled,
  notificationsEnabled,
  setNotificationsEnabled,
}) => {
  const [userDropdown, setUserDropdown] = useState(false);

  const navItems: Array<{ id: ActivePage; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'portfolio', label: 'Rekap Investasi', icon: PieChart },
    { id: 'settings', label: 'Koneksi Sheet', icon: FileSpreadsheet },
  ];

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        playTerminalChime('ALERT');
      } else {
        alert('Izin notifikasi belum diizinkan di browser Anda.');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a0d14]/90 backdrop-blur-xl border-b border-[#1b2234] select-none text-xs shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand & Clean Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xl bg-blue-600/40 backdrop-blur-md border border-blue-400/50 text-white flex items-center justify-center font-bold text-sm shadow-[0_4px_16px_rgba(37,99,235,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.6)]">
              A
            </div>
          </div>
        </div>

        {/* Minimalist Multi-Page Navigation Bar with Liquid Glass */}
        <nav className="flex items-center gap-1.5 bg-[#0e1424]/70 p-1.5 rounded-2xl border border-[#1e273d]/80 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.06)]">
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
                    ? 'font-semibold text-white shadow-[0_4px_16px_rgba(37,99,235,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </LiquidButton>
            );
          })}
        </nav>

        {/* Right Section: Sync Pill, Audio, Alerts & Google User */}
        <div className="flex items-center gap-2">
          {/* Sheet Sync Pill */}
          <div
            onClick={() => onSelectPage('settings')}
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] cursor-pointer transition-all backdrop-blur-md ${
              sheetConnected
                ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300 shadow-[0_4px_14px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:bg-emerald-500/25'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${sheetConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="font-medium">
              {sheetConnected ? 'Google Sheet Tersambung' : 'Google Sheet Terputus'}
            </span>
          </div>

          {sheetConnected && (
            <LiquidButton
              onClick={onManualSync}
              disabled={isSyncing}
              title="Sinkronisasi sekarang"
              size="icon"
              variant="secondary"
              className="w-8 h-8 rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : 'text-slate-300'}`} />
            </LiquidButton>
          )}

          {/* Sound & Notification Toggle with Liquid Glass */}
          <LiquidButton
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playTerminalChime('ALERT');
            }}
            title={soundEnabled ? 'Suara aktif' : 'Suara nonaktif'}
            size="icon"
            variant={soundEnabled ? 'default' : 'secondary'}
            className={`w-8 h-8 rounded-xl ${
              soundEnabled ? 'border-blue-400/40 text-blue-300' : 'text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </LiquidButton>

          <LiquidButton
            onClick={handleToggleNotifications}
            title={notificationsEnabled ? 'Notifikasi aktif' : 'Aktifkan notifikasi browser'}
            size="icon"
            variant={notificationsEnabled ? 'default' : 'secondary'}
            className={`w-8 h-8 rounded-xl ${
              notificationsEnabled ? 'border-blue-400/40 text-blue-300' : 'text-slate-500'
            }`}
          >
            {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </LiquidButton>

          {/* Auth Button with Liquid Glass */}
          {user ? (
            <div className="relative">
              <LiquidButton
                onClick={() => setUserDropdown(!userDropdown)}
                variant="secondary"
                size="sm"
                className="gap-2 px-2.5 py-1.5 rounded-xl border-white/15"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="text-[11px] max-w-[100px] truncate">{user.displayName || user.email?.split('@')[0]}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </LiquidButton>

              {userDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0e1424]/95 backdrop-blur-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-2 z-50">
                  <div className="px-2.5 py-2 border-b border-[#1b2234] mb-1">
                    <p className="text-[11px] text-white font-semibold truncate">{user.displayName || 'Akun Google'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <LiquidButton
                    onClick={() => {
                      setUserDropdown(false);
                      onSelectPage('settings');
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-left text-slate-300 text-[11px] h-8 px-2.5"
                  >
                    <span>Pengaturan Google Sheet</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </LiquidButton>
                  <LiquidButton
                    onClick={() => {
                      setUserDropdown(false);
                      onLogout();
                    }}
                    variant="destructive"
                    size="sm"
                    className="w-full justify-start text-left text-rose-300 text-[11px] h-8 px-2.5 mt-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Keluar Akun</span>
                  </LiquidButton>
                </div>
              )}
            </div>
          ) : (
            <LiquidButton
              onClick={onLogin}
              disabled={isLoggingIn}
              variant="default"
              size="sm"
              className="gap-2 px-3.5 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 border-white/50 shadow-[0_4px_16px_rgba(255,255,255,0.25),inset_0_1px_1.5px_rgba(255,255,255,0.8)] font-semibold"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
            </LiquidButton>
          )}
        </div>
      </div>
    </header>
  );
};
