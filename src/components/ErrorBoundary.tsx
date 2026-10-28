import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    // Clear any potential corrupted local cache if needed
    try {
      this.setState({ hasError: false, error: null, errorInfo: null });
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  private handleResetLocalStorage = () => {
    try {
      localStorage.removeItem('investment_diary_privacy');
      localStorage.removeItem('apex_connected_sheet_id');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f6f4ee] dark:bg-[#080a0f] text-[#1c1917] dark:text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#ffffff] dark:bg-[#0f141f] border border-[#e5e0d5] dark:border-[#1e293b] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1c1917] dark:text-white">
                  Terjadi Kendala Memuat Aplikasi
                </h2>
                <p className="text-xs text-[#6e685f] dark:text-slate-400">
                  Investment Diary mendeteksi error pada tampilan.
                </p>
              </div>
            </div>

            <div className="bg-[#f2efe9] dark:bg-[#161d2d] rounded-xl p-3 text-xs font-mono text-[#44403c] dark:text-slate-300 overflow-x-auto max-h-32 border border-[#e5e0d5] dark:border-[#232d42]">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <p className="text-xs text-[#6e685f] dark:text-slate-400 leading-relaxed">
              Silakan klik tombol di bawah untuk memuat ulang sistem. Data Google Sheet Anda tetap aman di cloud.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.99]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Muat Ulang Aplikasi
              </button>
              <button
                type="button"
                onClick={this.handleResetLocalStorage}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-[#e5e0d5] dark:border-[#232d42] hover:bg-[#efebe2] dark:hover:bg-[#1a2334] text-xs text-[#6e685f] dark:text-slate-300 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Reset Cache &amp; Buka Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
