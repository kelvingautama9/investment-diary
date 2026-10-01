import { GoogleGenAI } from '@google/genai';
import type { InvestmentRecord, TradingSignal } from '../types';

// In-Memory Circuit Breaker Cooldown System (Adaptive Short Isolation)
const modelCooldownUntil = new Map<string, number>();

export function markModelCooldown(modelName: string, errorString: string) {
  let durationMs = 30 * 1000; // Default 30 detik agar cepat mencoba ulang

  if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
    const match = errorString.match(/retry in\s+([0-9.]+)\s*s/i);
    if (match && match[1]) {
      durationMs = (Math.ceil(parseFloat(match[1])) + 5) * 1000;
    } else {
      durationMs = 45 * 1000; // 45 detik
    }
  } else if (errorString.includes('503') || errorString.includes('UNAVAILABLE')) {
    durationMs = 15 * 1000; // 15 detik untuk lonjakan sementara
  } else if (errorString.includes('Timeout') || errorString.includes('ETIMEDOUT')) {
    durationMs = 10 * 1000; // 10 detik
  }

  modelCooldownUntil.set(modelName, Date.now() + durationMs);
  console.warn(`[Auto Fallback] Model ${modelName} dialihkan (${Math.round(durationMs / 1000)}s): ${errorString.slice(0, 60)}`);
}

export function isModelInCooldown(modelName: string): boolean {
  const expiry = modelCooldownUntil.get(modelName);
  if (!expiry) return false;
  if (Date.now() >= expiry) {
    modelCooldownUntil.delete(modelName);
    return false;
  }
  return true;
}

export function clearAllCooldowns() {
  modelCooldownUntil.clear();
}

export function getCooldownStatus(): Record<string, number> {
  const status: Record<string, number> = {};
  const now = Date.now();
  for (const [m, exp] of modelCooldownUntil.entries()) {
    if (exp > now) {
      status[m] = Math.ceil((exp - now) / 1000);
    } else {
      modelCooldownUntil.delete(m);
    }
  }
  return status;
}

// Master System Prompt (Citadel / Bridgewater / BlackRock standard)
export const HEDGE_FUND_SYSTEM_PROMPT = `Anda adalah "Investment Diary AI" - Chief Risk Officer (CRO), Quantitative Portfolio Strategist, dan Senior Performance Analyst yang memiliki standar pengetahuan, metodologi, dan disiplin setara dengan eksekutif hedge fund global papan atas dunia seperti Citadel (Ken Griffin), Bridgewater Associates (Ray Dalio - Pure Alpha & All Weather), dan BlackRock (Aladdin Risk Engine).

Tugas utama Anda adalah mengaudit portofolio dan jurnal trading pengguna, mengevaluasi kedisiplinan eksekusi aturan, menghitung metrik statistik kinerja secara matematis mutlak tanpa halusinasi, mendeteksi anomali psikologi/eksekusi trader, serta memberikan bimbingan taktis berbasis data institusional (Data-driven Institutional Framework).

=======================================================
1. KODE ETIK & PERILAKU ANALIS HEDGE FUND:
=======================================================
- Anda bertindak sebagai AUDITOR RISIKO & STRATEGIS PORTOFOLIO INSTITUSIONAL.
- JANGAN PERNAH menyarankan "Beli instrumen X sekarang" atau "Pasti terbang to the moon". Fokuskan telaah pada:
  * Asimetri Risiko vs Imbal Hasil (Risk-to-Reward Ratio)
  * Kepatuhan terhadap Rencana Trading (Execution Rigor & Discipline)
  * Ekspektasi Matematis (Mathematical Expectancy per trade)
  * Hambatan Biaya Transaksi: Spread & Slippage Drag
  * Diversifikasi & Konsentrasi Risiko (Prinsip Risk Parity Bridgewater)
  * Deteksi Bias Perilaku Trader: Overtrading, Revenge Trading, Stop Loss Violation, Early Profit Taking (Disposition Effect).
- Berbicara dengan gaya: Tenang, objektif, berwibawa, analitis, matematis, konstruktif, lugas tanpa basa-basi, menggunakan standar bahasa finansial institusional Wall Street dalam Bahasa Indonesia profesional yang elegan.

=======================================================
2. FORMULA MATEMATIKA BAKU (WAJIB PRESISI 100%):
=======================================================
- Total Modal Masuk Aktif = Jumlah nominal transaksi berstatus 'Floating' saja (posisi 'Realized' modalnya sudah bebas di kas, jangan dihitung sebagai modal aktif!).
- Total Laba Bersih Portofolio = Akumulasi Laba Bersih Realized + Laba Bersih Floating.
- Win Rate (%) = (Total Trade Menang / Total Trade Selesai) * 100
- Profit Factor = Total Gross Profit (IDR/USD) / Total Gross Loss (IDR/USD)
  * > 2.0  = Elite Institutional Alpha (Kinerja Luar Biasa)
  * 1.5 - 2.0 = Sehat & Konsisten Menguntungkan (Sustainable)
  * 1.0 - 1.4 = Rawan Breakeven / Sensitif terhadap Biaya Broker
  * < 1.0 = Erosi Modal / Strategi Merugi (Losing Strategy)
- Average Win / Average Loss Ratio = Rata-rata nominal profit / Rata-rata nominal loss
- Mathematical Expectancy (per trade) = (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
- Spread Drag (%) = (Total Biaya Spread / Total Laba Kotor) * 100

=======================================================
3. STRUKTUR PENYAJIAN AUDIT INSTITUSIONAL:
=======================================================
Setiap kali diminta audit atau analisa komprehensif, sajikan dengan struktur:
1. Executive Summary: Diagnosis 2-3 kalimat mengenai kesehatan modal dan efisiensi portofolio.
2. Institutional Performance Audit Table: Tabel Markdown berstandar Hedge Fund:
   | Metrik Kinerja Portofolio | Nilai Statistik Riil | Benchmark Institusional | Evaluasi & Status |
3. Alpha Contributors vs Detractors: Analisis aset pemenang terbesar (contoh: SPCX, GOLD) vs aset penyumbang kerugian terbesar (contoh: MSFT, WDC, QCOM).
4. Deteksi Anomali Psikologi & Manajemen Risiko: Peringatan jika ada trade beruntun, kerugian melebihi batas wajar, atau deviasi dari risk limit.
5. Strategic Directives: 3-4 langkah aksi taktis untuk memaksimalkan expectancy dan melindungi modal.

=======================================================
4. DETEKSI ANOMALI PSIKOLOGI TRADER:
=======================================================
1. [REVENGE TRADING ALERT]: Pembukaan posisi baru dalam waktu berdekatan setelah mengalami kerugian besar.
2. [STOP LOSS VIOLATION / OVERLEVERAGE]: Kerugian pada satu posisi > 2.5x rata-rata kerugian normal.
3. [DISPOSITION EFFECT]: Membiarkan posisi loss mengambang berlarut-larut sementara posisi profit buru-buru direalisasikan.
4. [OVERTRADING SYNDROME]: Frekuensi trade melonjak drastis di luar trading plan harian.
`;

// Priority hierarchy model list:
// Put gemini-3.6-flash, 3.5-flash, flash-latest and 3.1-flash-lite FIRST to avoid 3.8 rate-limits
export const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-pro',
  'gemini-3.1-pro-preview',
  'gemini-3.8-flash',
];

export interface ChatRequestPayload {
  message: string;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  journalData?: {
    records: InvestmentRecord[];
    summary?: any;
    activeSignal?: TradingSignal | null;
  };
}

export function formatJournalContext(journalData?: ChatRequestPayload['journalData']): string {
  if (!journalData || !journalData.records || journalData.records.length === 0) {
    return 'DATA JURNAL TRADING: Belum ada transaksi tercatat.';
  }

  const records = journalData.records;
  const floating = records.filter(r => r.status === 'Floating');
  const realized = records.filter(r => r.status === 'Realized');

  const totalFloatingCapital = floating.reduce((sum, r) => sum + (r.nominalIdr || 0), 0);
  const totalFloatingGain = floating.reduce((sum, r) => sum + (r.labaBersih || 0), 0);
  const totalRealizedGain = realized.reduce((sum, r) => sum + (r.labaBersih || 0), 0);
  const totalNetProfit = totalFloatingGain + totalRealizedGain;

  const totalSpreadCost = records.reduce((sum, r) => sum + Math.abs(r.spreadCost || 0), 0);
  const winCount = records.filter(r => (r.labaBersih || 0) >= 0).length;
  const lossCount = records.filter(r => (r.labaBersih || 0) < 0).length;

  // Optimize token usage: prioritize recent 25 trades to avoid token limits
  const visibleRecords = records.length > 25 ? records.slice(-25) : records;

  const tradeListSummary = visibleRecords.map(r => {
    return `- [${r.type}] ${r.asset} | Status: ${r.status} | Entry: ${r.entryDate} | Exit: ${r.exitDate || '—'} | Modal: Rp ${Math.round(r.nominalIdr).toLocaleString('id-ID')} | PnL: ${r.pnlPercent >= 0 ? '+' : ''}${r.pnlPercent.toFixed(2)}% | Spread: Rp ${Math.round(r.spreadCost).toLocaleString('id-ID')} | Net PnL: Rp ${Math.round(r.labaBersih).toLocaleString('id-ID')}`;
  }).join('\n');

  return `
DATA JURNAL PORTOFOLIO INVESTASI AKTIF (GROUND TRUTH GOOGLE SHEET):
- Total Transaksi: ${records.length} (${realized.length} Realized, ${floating.length} Floating Aktif)
- Total Modal Masuk Aktif (Hanya Floating): Rp ${Math.round(totalFloatingCapital).toLocaleString('id-ID')}
- Total Laba Bersih Portofolio: Rp ${Math.round(totalNetProfit).toLocaleString('id-ID')} (Realized: Rp ${Math.round(totalRealizedGain).toLocaleString('id-ID')} | Floating: Rp ${Math.round(totalFloatingGain).toLocaleString('id-ID')})
- Net ROI Portofolio: ${totalFloatingCapital > 0 ? ((totalNetProfit / totalFloatingCapital) * 100).toFixed(2) : '0'}%
- Total Biaya Spread Drag: Rp ${Math.round(totalSpreadCost).toLocaleString('id-ID')}
- Win Trades: ${winCount} | Loss Trades: ${lossCount} | Win Rate: ${records.length > 0 ? Math.round((winCount / records.length) * 100) : 0}%

DAFTAR TRANSAKSI (TERBARU):
${tradeListSummary}
${records.length > 25 ? `... (${records.length - 25} transaksi historis lainnya telah teragregasi dalam metrik KPI di atas)` : ''}
`;
}
