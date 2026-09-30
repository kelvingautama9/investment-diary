'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { InvestmentRecord, TradingSignal } from '../types';
import {
  Sparkles,
  Send,
  X,
  Trash2,
  Copy,
  Check,
  Minimize2,
  Maximize2,
  Square,
  Columns,
  RefreshCw,
  Key,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  Bot,
  Terminal,
  ExternalLink,
} from 'lucide-react';

interface AIPopupChatbotProps {
  records: InvestmentRecord[];
  activeSignal: TradingSignal | null;
  sheetTitle: string;
}

export type ChatSizeMode = 'mini' | 'compact' | 'wide' | 'fullscreen';

interface ChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
  modelUsed?: string;
  isPrivateKey?: boolean;
}

const STORAGE_KEY = 'blackeye_trading_gemini_key';

export const AIPopupChatbot: React.FC<AIPopupChatbotProps> = ({
  records,
  activeSignal,
  sheetTitle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sizeMode, setSizeMode] = useState<ChatSizeMode>('compact');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'AI',
      text: `### 🏛️ BLACKEYE AI: Institutional Risk & Performance Engine
Selamat datang di terminal analisa risiko portofolio berstandar hedge fund tier-1 (**Citadel & Bridgewater Associates**).

Saya telah memuat **${records.length} data transaksi** dari Google Sheet tab **${sheetTitle}** dengan model utama **gemini-3.6-flash** (auto-fallback ke **3.5, 3.8, flash-latest**). Siap melakukan audit mendalam terhadap:
- **Win Rate & Profit Factor Realistis**
- **Risk-to-Reward (RR) Asymmetry & Spread Drag**
- **Deteksi Anomali Perilaku (Revenge Trading & Stop-Loss Violation)**
- **Audit Kontributor Alpha (SPCX, GOLD) vs Performance Detractor**

Pilih salah satu audit instan di bawah atau ketik pertanyaan spesifik Anda:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.6-flash',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // BYOK (Bring Your Own Key) States
  const [privateApiKey, setPrivateApiKey] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ valid: boolean; text: string } | null>(null);
  const [showMaskedKey, setShowMaskedKey] = useState(false);

  // 60FPS Streaming Ticker Engine States
  const [streamSlice, setStreamSlice] = useState<string>('');
  const [activeStreamingModel, setActiveStreamingModel] = useState<string>('gemini-3.6-flash');
  const [activeStreamingIsPrivate, setActiveStreamingIsPrivate] = useState<boolean>(false);

  const targetTextRef = useRef<string>('');
  const displayedLengthRef = useRef<number>(0);
  const isStreamFinishedRef = useRef<boolean>(true);
  const rafIdRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const quickPromptsScrollRef = useRef<HTMLDivElement>(null);

  // Quick Chips berstandar institusional (Citadel / Bridgewater / BlackRock)
  const quickChips = [
    {
      icon: '📊',
      label: 'Hitung Win Rate, Profit Factor & Expectancy',
      prompt: 'Lakukan audit menyeluruh terhadap Win Rate riil, Profit Factor matematis, dan Expected Value (EV) per trade berdasarkan seluruh transaksi portofolio saya.',
    },
    {
      icon: '⚠️',
      label: 'Audit Risk-to-Reward (RR) & Spread Drag',
      prompt: 'Analisis rasio Risk-to-Reward rata-rata portofolio saya dan hitung seberapa besar hambatan biaya komisi/spread broker (Spread Drag) menggerus Laba Bersih.',
    },
    {
      icon: '🧠',
      label: 'Deteksi Anomali Psikologi & Revenge Trading',
      prompt: 'Audit kronologi riwayat transaksi saya untuk mendeteksi anomali psikologi: Revenge Trading, Stop Loss Violation, Overleveraging, atau Early Exit (Disposition Effect).',
    },
    {
      icon: '🏆',
      label: 'Review Alpha Contributors vs Detractors',
      prompt: 'Sajikan komparasi mendalam antara aset penghasil Alpha terbesar (top performers) vs aset pemicu erosi modal (underperformers) beserta rekomendasi taktis.',
    },
    {
      icon: '🛡️',
      label: 'Stress-Test Portofolio ala Bridgewater All-Weather',
      prompt: 'Lakukan evaluasi konsentrasi risiko portofolio dengan prinsip Risk Parity Bridgewater. Apakah alokasi modal saat ini aman jika terjadi volatilitas pasar tiba-tiba?',
    },
    {
      icon: '⚖️',
      label: 'Audit Stop Loss Violation & Asimetri Risiko',
      prompt: 'Periksa transaksi-transaksi loss saya: apakah kerugian terjadi secara terkontrol sesuai plan atau ada pelanggaran stop loss di atas toleransi 2.5x rata-rata kerugian normal?',
    },
  ];

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamSlice, isOpen]);

  // Masked API Key helper
  const getMaskedKey = (key: string) => {
    if (!key || key.length < 12) return '••••••••••••••••';
    return `${key.slice(0, 8)}...••••••••...${key.slice(-4)}`;
  };

  // 60FPS Micro-Ticker Pump Loop using requestAnimationFrame
  const startTicker = useCallback(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    const pump = () => {
      const target = targetTextRef.current;
      const current = displayedLengthRef.current;

      if (current < target.length) {
        const distance = target.length - current;
        let step = 1;
        if (distance > 160) step = Math.min(distance, Math.ceil(distance / 6));
        else if (distance > 60) step = Math.min(distance, Math.ceil(distance / 10));
        else if (distance > 20) step = 3;
        else if (distance > 6) step = 2;
        else step = 1;

        displayedLengthRef.current = Math.min(target.length, current + step);
        setStreamSlice(target.slice(0, displayedLengthRef.current));
      }

      if (!isStreamFinishedRef.current || displayedLengthRef.current < targetTextRef.current.length) {
        rafIdRef.current = requestAnimationFrame(pump);
      } else {
        // Stream fully caught up & finished!
        const finalMessage = targetTextRef.current;
        if (finalMessage) {
          setMessages(prev => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              sender: 'AI',
              text: finalMessage,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              modelUsed: activeStreamingModel,
              isPrivateKey: activeStreamingIsPrivate,
            },
          ]);
        }
        setStreamSlice('');
        targetTextRef.current = '';
        displayedLengthRef.current = 0;
        setIsLoading(false);
      }
    };

    rafIdRef.current = requestAnimationFrame(pump);
  }, [activeStreamingModel, activeStreamingIsPrivate]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Send Prompt Handler with SSE streaming & Fallback cascade
  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Reset streaming ticker buffers
    targetTextRef.current = '';
    displayedLengthRef.current = 0;
    isStreamFinishedRef.current = false;
    setStreamSlice('');

    // Start 60fps micro-ticker loop
    startTicker();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };

      if (privateApiKey) {
        headers['x-gemini-api-key'] = privateApiKey;
      }

      let fetchSuccess = false;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: textToSend,
            history: messages.slice(-10).map(m => ({
              role: m.sender === 'AI' ? 'model' : 'user',
              content: m.text,
            })),
            journalData: {
              records,
              activeSignal,
            },
          }),
        });

        if (res.ok) {
          fetchSuccess = true;
          const reader = res.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('event: meta')) {
                  // Handled next data line
                } else if (line.startsWith('data: ')) {
                  const rawData = line.slice(6).trim();
                  if (!rawData) continue;
                  try {
                    const parsed = JSON.parse(rawData);
                    if (parsed.modelUsed) {
                      setActiveStreamingModel(parsed.modelUsed);
                      if (typeof parsed.isPrivateKey === 'boolean') {
                        setActiveStreamingIsPrivate(parsed.isPrivateKey);
                      }
                    }
                    if (parsed.text) {
                      targetTextRef.current += parsed.text;
                    }
                  } catch {
                    targetTextRef.current += rawData;
                  }
                } else if (line.startsWith('event: done')) {
                  isStreamFinishedRef.current = true;
                }
              }
            }
          }
        }
      } catch (fetchErr) {
        console.warn('Backend /api/chat error (likely static hosting), trying client direct GenAI fallback...', fetchErr);
      }

      // If backend was not reached (e.g. pure static GitHub Pages), call Gemini directly in browser!
      if (!fetchSuccess) {
        const directKey =
          privateApiKey ||
          (typeof import.meta !== 'undefined' &&
            (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY));

        if (directKey) {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: directKey });
          const { HEDGE_FUND_SYSTEM_PROMPT, CANDIDATE_MODELS, formatJournalContext } = await import(
            '../services/aiChatService'
          );
          const journalCtx = formatJournalContext({ records, activeSignal });

          let directSuccess = false;
          for (const model of CANDIDATE_MODELS) {
            try {
              setActiveStreamingModel(model);
              setActiveStreamingIsPrivate(Boolean(privateApiKey));
              const stream = await ai.models.generateContentStream({
                model,
                contents: [
                  ...messages.slice(-10).map(m => ({
                    role: m.sender === 'AI' ? 'model' : 'user',
                    parts: [{ text: m.text }],
                  })),
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `${journalCtx}\n\nPertanyaan/Permintaan Trader:\n${textToSend}`,
                      },
                    ],
                  },
                ],
                config: {
                  systemInstruction: HEDGE_FUND_SYSTEM_PROMPT,
                  temperature: 0.2,
                },
              });

              for await (const chunk of stream) {
                if (chunk.text) {
                  targetTextRef.current += chunk.text;
                }
              }
              directSuccess = true;
              isStreamFinishedRef.current = true;
              break;
            } catch (modelErr: any) {
              console.warn(`[Client Direct] Model ${model} failed, cascading:`, modelErr?.message);
            }
          }

          if (directSuccess) return;
        }

        throw new Error('Gagal menghubungi endpoint backend dan kunci Gemini browser belum tersedia.');
      }

      isStreamFinishedRef.current = true;
    } catch (err: any) {
      console.error('Chat error:', err);
      isStreamFinishedRef.current = true;
      targetTextRef.current = `### ⚠️ Gangguan Jalur Komunikasi Institusional
Terjadi kendala jaringan saat menghubungi model analitis (${err?.message || 'Koneksi terputus'}). 
Pastikan server berjalan atau gunakan **Private API Key (BYOK)** Anda sendiri di ikon gerigi atas untuk stabilitas koneksi tanpa batas antrian kuota publik.`;
    }
  };

  // BYOK Validation
  const handleValidateKey = async () => {
    if (!keyInput.trim()) return;
    setIsValidatingKey(true);
    setKeyStatusMsg(null);

    try {
      const res = await fetch('/api/chat/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setKeyStatusMsg({ valid: true, text: '✅ Kunci Valid! Terhubung ke Google GenAI Engine.' });
      } else {
        setKeyStatusMsg({ valid: false, text: `❌ Validasi Gagal: ${data.error || 'Kunci ditolak'}` });
      }
    } catch (err: any) {
      setKeyStatusMsg({ valid: false, text: `❌ Error Jaringan: ${err?.message}` });
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleSaveKey = () => {
    if (!keyInput.trim()) {
      localStorage.removeItem(STORAGE_KEY);
      setPrivateApiKey('');
    } else {
      localStorage.setItem(STORAGE_KEY, keyInput.trim());
      setPrivateApiKey(keyInput.trim());
    }
    setShowKeyModal(false);
  };

  const handleRemoveKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPrivateApiKey('');
    setKeyInput('');
    setShowKeyModal(false);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Carousel scroll helpers
  const handleCarouselScroll = (dir: 'left' | 'right') => {
    if (!quickPromptsScrollRef.current) return;
    const distance = 260;
    quickPromptsScrollRef.current.scrollBy({
      left: dir === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  // Markdown institutional formatter helper
  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    const flushTable = (keyIndex: number) => {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        const body = tableRows.slice(1);

        elements.push(
          <div key={`table-${keyIndex}`} className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-slate-300">
                  {headers.map((h, i) => (
                    <th key={`th-${i}`} className="py-2.5 px-3 font-bold tracking-tight">
                      {h.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {body.map((row, rIdx) => (
                  <tr key={`tr-${rIdx}`} className="hover:bg-white/5 transition-colors">
                    {row.map((cell, cIdx) => {
                      const text = cell.trim();
                      const isAlert = text.includes('ALERT') || text.includes('VIOLATION') || text.includes('Merugi');
                      const isPositive = text.includes('Unggul') || text.includes('Sehat') || text.includes('Positif') || text.includes('Alpha');
                      return (
                        <td key={`td-${cIdx}`} className="py-2 px-3">
                          {isAlert ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30 text-[11px]">
                              {text}
                            </span>
                          ) : isPositive ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 text-[11px]">
                              {text}
                            </span>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table line detect
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Skip separator line |---|---|
        if (trimmed.includes('---')) {
          inTable = true;
          return;
        }
        const cells = trimmed.split('|').slice(1, -1);
        tableRows.push(cells);
        inTable = true;
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${idx}`} className="text-sm font-bold text-white mt-3.5 mb-1.5 flex items-center gap-1.5">
            {trimmed.slice(4)}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${idx}`} className="text-base font-extrabold text-blue-400 mt-4 mb-2">
            {trimmed.slice(3)}
          </h3>
        );
        return;
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.slice(2);
        // Highlight alerts
        let renderedText: React.ReactNode = bulletText;
        if (bulletText.includes('[REVENGE TRADING ALERT]')) {
          renderedText = (
            <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> [REVENGE TRADING ALERT]
            </span>
          );
        }

        elements.push(
          <div key={`li-${idx}`} className="flex items-start gap-2 text-xs text-slate-200 my-1 leading-relaxed pl-1">
            <span className="text-blue-400 font-bold mt-0.5">•</span>
            <div>{renderedText}</div>
          </div>
        );
        return;
      }

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`sp-${idx}`} className="h-1.5" />);
        return;
      }

      // Standard text
      elements.push(
        <p key={`p-${idx}`} className="text-xs text-slate-200 leading-relaxed my-1">
          {trimmed}
        </p>
      );
    });

    flushTable(lines.length);
    return elements;
  };

  // Dimensions based on sizeMode
  const getContainerDimensions = () => {
    switch (sizeMode) {
      case 'mini':
        return 'fixed bottom-5 right-5 z-50 w-[420px] max-w-[94vw] h-[55vh] max-h-[500px] rounded-2xl';
      case 'compact':
        return 'fixed bottom-5 right-5 z-50 w-[540px] md:w-[580px] max-w-[94vw] h-[86vh] max-h-[660px] rounded-2xl';
      case 'wide':
        return 'fixed bottom-5 right-5 z-50 w-[900px] md:w-[960px] max-w-[96vw] h-[90vh] max-h-[740px] rounded-2xl';
      case 'fullscreen':
        return 'fixed inset-0 sm:inset-4 z-50 w-auto h-auto rounded-none sm:rounded-3xl';
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-semibold text-xs shadow-[0_10px_30px_rgba(37,99,235,0.45)] hover:scale-105 active:scale-95 transition-all group border border-white/20 select-none"
        >
          <div className="relative">
            <Bot className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span>HedgeFund AI</span>
          <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
            {records.length} Trade
          </span>
        </button>
      )}

      {/* Pop-up Glassmorphism Modal / Drawer */}
      {isOpen && (
        <div
          className={`${getContainerDimensions()} flex flex-col bg-zinc-950/85 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 select-none`}
        >
          {/* Ambient Radiant Glow Background Accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent rounded-bl-full pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-white/5 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white tracking-tight">
                    BLACKEYE AI
                  </h3>
                  <span className="text-[10px] text-blue-300 px-1.5 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 font-mono">
                    HedgeFund Tier-1
                  </span>

                  {/* Private Key Typewriter/Ping Indicator */}
                  {privateApiKey ? (
                    <span
                      onClick={() => setShowKeyModal(true)}
                      className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 hover:bg-emerald-500/25 transition-all"
                      title="Menggunakan Private Gemini API Key Anda sendiri"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Private API Key</span>
                    </span>
                  ) : (
                    <span
                      onClick={() => setShowKeyModal(true)}
                      className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-400 bg-white/5 hover:text-white transition-colors"
                      title="Klik untuk memasukkan Private API Key (BYOK)"
                    >
                      <Key className="w-3 h-3" />
                      <span>BYOK</span>
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Citadel & Bridgewater Risk Protocol</span>
                  <span>•</span>
                  <span className="text-slate-300 font-medium">Tab: {sheetTitle}</span>
                </div>
              </div>
            </div>

            {/* Header Right Action Controls */}
            <div className="flex items-center gap-1">
              {/* BYOK Settings Button */}
              <button
                type="button"
                onClick={() => {
                  setKeyInput(privateApiKey);
                  setShowKeyModal(true);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="Pengaturan Kunci API Pribadi (BYOK)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>

              {/* Size Mode Switcher Controls */}
              <div className="hidden sm:flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5 mx-1">
                <button
                  type="button"
                  onClick={() => setSizeMode('mini')}
                  className={`p-1.5 rounded-md transition-all ${
                    sizeMode === 'mini' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mini Mode (420px)"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setSizeMode('compact')}
                  className={`p-1.5 rounded-md transition-all ${
                    sizeMode === 'compact' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compact Mode (Standar)"
                >
                  <Square className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setSizeMode('wide')}
                  className={`p-1.5 rounded-md transition-all ${
                    sizeMode === 'wide' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Wide Mode (Review Luas)"
                >
                  <Columns className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setSizeMode(sizeMode === 'fullscreen' ? 'compact' : 'fullscreen')}
                  className={`p-1.5 rounded-md transition-all ${
                    sizeMode === 'fullscreen' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Fullscreen Mode"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>

              {/* Clear chat */}
              <button
                type="button"
                onClick={() => {
                  setMessages(prev => [prev[0]]);
                  setStreamSlice('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all"
                title="Hapus riwayat pesan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="Tutup Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BYOK Settings Drawer / Modal Overlay */}
          {showKeyModal && (
            <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md p-5 flex flex-col justify-center animate-in fade-in">
              <div className="w-full max-w-md mx-auto bg-[#10141f] border border-[#1b2234] rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">Private Gemini API Key (BYOK)</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Masukkan Gemini API Key pribadi Anda untuk akses langsung tanpa batas dan terbebas dari antrian limit server publik. Key tersimpan aman secara lokal di browser Anda.
                </p>

                {/* Default Key Info Box */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 space-y-1">
                  <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Kunci Default Server Terdeteksi Aktif</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Kunci bawaan sistem tersimpan di file <code>.env</code> root project (<code>GEMINI_API_KEY</code>). Anda dapat mengosongkan input ini jika ingin menggunakan kuota default bawaan.
                  </p>
                </div>

                {/* Fallback Chain Badge */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Hirarki Auto-Fallback Model Cerdas (Hedge Fund Engine):
                  </span>
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                      1. gemini-3.6-flash (Utama)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                      2. gemini-3.5-flash
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                      3. gemini-3.8-flash
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                      4. gemini-flash-latest
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Google Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showMaskedKey ? 'text' : 'password'}
                      value={keyInput}
                      onChange={e => setKeyInput(e.target.value)}
                      placeholder="AIzaSyB3..."
                      className="w-full bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMaskedKey(!showMaskedKey)}
                      className="absolute right-2.5 top-2 text-[10px] text-slate-400 hover:text-white"
                    >
                      {showMaskedKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {privateApiKey && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Tersimpan saat ini: {getMaskedKey(privateApiKey)}
                    </span>
                  )}
                </div>

                {keyStatusMsg && (
                  <div
                    className={`p-2.5 rounded-xl text-xs ${
                      keyStatusMsg.valid
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                    }`}
                  >
                    {keyStatusMsg.text}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleValidateKey}
                      disabled={isValidatingKey || !keyInput.trim()}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      {isValidatingKey ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Menguji...</span>
                        </>
                      ) : (
                        <span>Uji Koneksi</span>
                      )}
                    </button>
                    {privateApiKey && (
                      <button
                        type="button"
                        onClick={handleRemoveKey}
                        className="px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs transition-all"
                      >
                        Hapus Key
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
                  >
                    Simpan Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      {isUser ? 'Anda (Trader)' : 'BLACKEYE HedgeFund AI'}
                    </span>
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-blue-300">
                        {msg.modelUsed}
                      </span>
                    )}
                    {msg.isPrivateKey && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Private Key" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`relative group max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-xs shadow-lg leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-[#10141f] border border-[#1e273d] text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      renderFormattedMarkdown(msg.text)
                    )}

                    {/* Copy action button */}
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="absolute right-2 top-2 p-1.5 rounded-lg bg-black/40 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Salin Analisis"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Fluid 60FPS Streaming Ticker Output */}
            {isLoading && (
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    BLACKEYE Engine Sedang Menganalisis...
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-mono text-blue-300">
                    {activeStreamingModel}
                  </span>
                </div>

                <div className="max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tl-none p-3.5 sm:p-4 bg-[#10141f] border border-blue-500/30 text-slate-200 text-xs shadow-2xl leading-relaxed">
                  {streamSlice ? (
                    renderFormattedMarkdown(streamSlice)
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>Mengalkulasi matriks risiko portofolio Google Sheet...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel (Drag, Wheel, Arrow Controls) */}
          <div className="px-3 py-2 border-t border-white/5 bg-black/30 relative">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => handleCarouselScroll('left')}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Geser Kiri"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div
                ref={quickPromptsScrollRef}
                onWheel={e => {
                  if (quickPromptsScrollRef.current && e.deltaY) {
                    quickPromptsScrollRef.current.scrollLeft += e.deltaY;
                  }
                }}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 cursor-grab active:cursor-grabbing"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {quickChips.map((chip, idx) => (
                  <button
                    key={`chip-${idx}`}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSend(chip.prompt)}
                    className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 text-slate-300 hover:text-white text-[11px] font-medium transition-all shrink-0 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <span>{chip.icon}</span>
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleCarouselScroll('right')}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Geser Kanan"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Input Chat Area */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 sm:p-4 border-t border-white/10 bg-white/5 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Tanyakan analisis portofolio, metrik RR, evaluasi trade SPCX/NVDA..."
              disabled={isLoading}
              className="flex-1 bg-[#0b0e17] border border-[#1e273d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0"
            >
              <span>Kirim</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
