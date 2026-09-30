# 📘 Panduan Arsitektur, Logika Bisnis & Integrasi Aplikasi Rekap Investasi

Dokumen ini berisi dokumentasi teknis menyeluruh (*full technical specification*) dari seluruh logika, formula finansial, integrasi Google Sheets API, sistem autentikasi OAuth2, visualisasi chart, heatmap, dan desain UI/UX untuk kebutuhan penggabungan (*merge/integration*) ke dalam website utama Anda.

---

## 📑 Daftar Isi
1. [Ringkasan Eksekutif & Tech Stack](#1-ringkasan-eksekutif--tech-stack)
2. [Arsitektur Struktur File & Komponen](#2-arsitektur-struktur-file--komponen)
3. [Integrasi Google Sheets API & Google OAuth2](#3-integrasi-google-sheets-api--google-oauth2)
4. [Logika Parsing Data & Format Indonesia (Locale Parsing)](#4-logika-parsing-data--format-indonesia-locale-parsing)
5. [Logika Finansial & Formula Akuntansi Portofolio](#5-logika-finansial--formula-akuntansi-portofolio)
6. [Logika Kurva Pertumbuhan & Chart Visualisasi (Line & Bar)](#6-logika-kurva-pertumbuhan--chart-visualisasi-line--bar)
7. [Logika Visual Performance Heatmap](#7-logika-visual-performance-heatmap)
8. [Tabel Rekap Transaksi & Manajemen Modal (CRUD)](#8-tabel-rekap-transaksi--manajemen-modal-crud)
9. [Standar Desain UI/UX & Tailwind Styling](#9-standar-desain-uiux--tailwind-styling)
10. [Panduan Langkah-demi-Langkah Penggabungan ke Website Utama](#10-panduan-langkah-demi-langkah-penggabungan-ke-website-utama)

---

## 1. Ringkasan Eksekutif & Tech Stack

Aplikasi ini adalah **Portfolio & Investment Journal Management System** berstandar institusional yang mensinkronkan data dua arah secara *real-time* dengan Google Sheets (Spreadsheet).

### Teknologi Inti:
* **Frontend Core**: React 18+ (SPA), TypeScript (Strict Mode).
* **Styling**: Tailwind CSS v4, Lucide React Icons.
* **Visualisasi & Charts**: Recharts (`ComposedChart`, `Line`, `Bar`, `Cell`, `ReferenceLine`, SVG Filters).
* **Autentikasi & API Cloud**: Firebase Auth / Google Identity Services (OAuth2 Client-side).
* **Sinkronisasi Data**: Google Sheets REST API v4 & Google Drive API v3.

---

## 2. Arsitektur Struktur File & Komponen

Untuk memindahkan fitur ini ke website utama Anda, cukup salin struktur folder berikut:

```text
src/
├── types.ts                              # Definisi tipe TypeScript utama
├── services/
│   ├── firebaseAuth.ts                   # Login Google, token refresh & session
│   └── googleSheets.ts                   # REST API Google Sheets & parsing engine
├── components/
│   ├── Header.tsx                        # Bar navigasi atas, status sync & user session
│   ├── InvestmentDashboard.tsx           # Dashboard utama (KPI Cards, Heatmap, Ringkasan P:S)
│   ├── DetailedEquityChart.tsx           # Kurva akumulasi pertumbuhan (Line) & Bar toggle
│   ├── AssetPerformanceHeatmap.tsx       # Peta sebaran kinerja aset (Heatmap dinamis)
│   ├── TradeLedgerTable.tsx              # Tabel buku besar transaksi + export CSV & filter
│   ├── AddEditTradeModal.tsx             # Modal form tambah & edit transaksi
│   ├── DeleteConfirmModal.tsx            # Modal konfirmasi hapus baris
│   ├── GoogleSheetSettingsPage.tsx       # Halaman konfigurasi spreadsheet & auto-sync
│   └── AIPopupChatbot.tsx                # Asisten analisa portofolio cerdas
└── App.tsx                               # Container induk & sinkronisasi state
```

---

## 3. Integrasi Google Sheets API & Google OAuth2

### 3.1. Izin / OAuth Scopes yang Diperlukan
Aplikasi membutuhkan 2 cakupan izin (OAuth Scopes) dari Google:
1. `https://www.googleapis.com/auth/spreadsheets`: Untuk membaca dan menulis baris tabel transaksi di Google Sheets.
2. `https://www.googleapis.com/auth/drive.readonly`: Untuk mendeteksi dan menampilkan daftar Spreadsheet yang dimiliki akun pengguna.

### 3.2. Alur Autentikasi (`src/services/firebaseAuth.ts`)
1. User mengklik **"Hubungkan Google Account"**.
2. Membuka popup autentikasi Google melalui `signInWithPopup(auth, googleProvider)`.
3. Setelah disetujui, `GoogleAuthProvider.credentialFromResult(result)` memberikan **Google Access Token**.
4. Token disimpan di memori dan didengarkan oleh `onAuthStateChanged`.
5. Apabila token kedaluwarsa (1 jam), fungsi `getAccessToken()` otomatis meminta token baru melalui `currentUser.getIdTokenResult(true)`.

### 3.3. Endpoint Google Sheets REST API v4 (`src/services/googleSheets.ts`)
* **Membaca Metadata & Tab Sheet**:
  ```http
  GET https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}
  Authorization: Bearer {ACCESS_TOKEN}
  ```
  Digunakan untuk mencari nama sheet tab yang cocok (mencari tab `INVESTMENT` atau `Invest`, jika tidak ditemukan menggunakan tab pertama `sheets[0]`).

* **Membaca Data Transaksi (Read)**:
  ```http
  GET https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{SHEET_TITLE}!A2:N50
  Authorization: Bearer {ACCESS_TOKEN}
  ```

* **Menambah Baris Baru (Create/Append)**:
  ```http
  POST https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{SHEET_TITLE}!A:N:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS
  Authorization: Bearer {ACCESS_TOKEN}
  Content-Type: application/json
  ```

* **Mengubah Baris yang Ada (Update)**:
  ```http
  PUT https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{SHEET_TITLE}!A{ROW}:N{ROW}?valueInputOption=USER_ENTERED
  Authorization: Bearer {ACCESS_TOKEN}
  Content-Type: application/json
  ```

* **Menghapus Baris (Delete Row)**:
  ```http
  POST https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}:batchUpdate
  Authorization: Bearer {ACCESS_TOKEN}
  Content-Type: application/json
  
  Body: {
    "requests": [{
      "deleteDimension": {
        "range": {
          "sheetId": {SHEET_ID},
          "dimension": "ROWS",
          "startIndex": {ROW_INDEX - 1},
          "endIndex": {ROW_INDEX}
        }
      }
    }]
  }
  ```

---

## 4. Logika Parsing Data & Format Indonesia (Locale Parsing)

Salah satu aspek terpenting dari sistem ini adalah **kemampuan membaca format angka Google Sheets regional Indonesia** dengan sempurna tanpa memotong angka nol.

### 4.1. Anatomi Perbedaan Format:
* **Format Internasional (US)**: `.` adalah desimal (`1,250.50`), `,` adalah ribuan.
* **Format Indonesia (ID)**: `.` adalah pemisah ribuan (`Rp 10.000.000`, `Rp -708.007`), `,` adalah desimal (`0,635`, `18,25%`, `207,7`).

### 4.2. Logika Solver Parser (`parseIndonesianNumber`)
Fungsi ini membedakan konteks kolom secara cerdas:

```typescript
function parseIndonesianNumber(
  val: any,
  options?: { isCurrency?: boolean; isKurs?: boolean; isDecimal?: boolean }
): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return 0;

  const hasRp = str.toLowerCase().includes('rp');
  const isCurrency = options?.isCurrency || hasRp;
  const isKurs = options?.isKurs;
  const isDecimal = options?.isDecimal;

  // Bersihkan teks non-numerik kecuali angka, titik, koma, minus
  let cleaned = str.replace(/[^\d.,\-]/g, '');
  if (!cleaned) return 0;

  // Kasus 1: Memiliki titik DAN koma sekaligus (contoh: "2.630.000,0")
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  // Kasus 2: Hanya memiliki koma (contoh: "0,635", "18,25%", "207,7")
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  // Kasus 3: Memiliki titik tanpa koma
  if (cleaned.includes('.')) {
    // A) Kolom Mata Uang (Rp -708.007, Rp 431.425, Rp -59.243)
    // Tanda titik SELALU pemisah ribuan mutlak!
    if (isCurrency) {
      cleaned = cleaned.replace(/\./g, '');
      return parseFloat(cleaned) || 0;
    }

    // B) Kolom Kurs IDR/USD (contoh: "17.890", "18.140")
    if (isKurs) {
      cleaned = cleaned.replace(/\./g, '');
      return parseFloat(cleaned) || 0;
    }

    // C) Desimal Murni (lot/persen jika dimasukkan dengan titik)
    if (isDecimal) {
      return parseFloat(cleaned) || 0;
    }

    // D) Cek Standar Ribuan Indonesia (bagian belakang titik memiliki 3 digit)
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = cleaned.replace(/\./g, '');
      return parseFloat(cleaned) || 0;
    }
  }

  return parseFloat(cleaned) || 0;
}
```

### 4.3. Pemetaan Kolom Google Sheets (A s/d N):
| Kolom | Nama Field | Tipe Data | Parser Option | Deskripsi |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `Type` | `BUY` \| `SELL` | String | Jenis transaksi |
| **B** | `Asset` | `string` | Ticker Upper | Simbol aset (GOLD, NVDA, SPCX, MSFT) |
| **C** | `Nominal (IDR)` | `number` | `isCurrency: true` | Modal pembelian dalam Rupiah |
| **D** | `Kurs IDR-USD` | `number` | `isKurs: true` | Kurs konversi saat entry (e.g. 17890) |
| **E** | `Jumlah` | `number` | `isDecimal: true` | Jumlah lot / lembar (e.g. 0.635) |
| **F** | `Entry Date` | `string` (ISO) | `parseDateToIso` | Tanggal beli (YYYY-MM-DD) |
| **G** | `Exit Date` | `string` (ISO) | `parseDateToIso` | Tanggal jual (kosong jika Floating) |
| **H** | `Entry Price` | `number` | Standar | Harga beli (USD atau IDR untuk GOLD) |
| **I** | `Exit Price` | `number` | Standar | Harga jual / harga saat ini |
| **J** | `PnL (%)` | `number` | `isDecimal: true` | Persentase laba kotor harga |
| **K** | `SPREAD 0.5%` | `number` | `isCurrency: true` | Biaya transaksi broker (selalu negatif) |
| **L** | `Laba Bersih` | `number` | `isCurrency: true` | Laba bersih final dalam Rupiah |
| **M** | `Status` | `Realized` \| `Floating` | Keyword Match | Status apakah posisi aktif atau closed |
| **N** | `Nilai Aset` | `number` | `isCurrency: true` | Valuasi terkini dari posisi floating |

---

## 5. Logika Finansial & Formula Akuntansi Portofolio

### 5.1. Formula Transaksi Individual
Untuk setiap baris transaksi:
$$\text{Effective Price} = \text{Exit Price} > 0 \ ?\ \text{Exit Price} : \text{Entry Price}$$
$$\text{PnL (\%)} = \frac{\text{Effective Price} - \text{Entry Price}}{\text{Entry Price}} \times 100$$
$$\text{Spread Cost (0.5\%)} = -(\text{Nominal IDR} \times 0.005)$$
$$\text{Laba Bersih (IDR)} = \left(\text{Nominal IDR} \times \frac{\text{PnL (\%)}}{100}\right) + \text{Spread Cost}$$
$$\text{Nilai Aset (Floating)} = \text{Status} == \text{'Floating'} \ ?\ (\text{Nominal IDR} + \text{Laba Bersih}) : 0$$

### 5.2. Formula Agregasi Kartu KPI Dashboard:
1. **Total Modal Masuk**:
   * **Aturan Akuntansi**: **HANYA** menjumlahkan posisi yang berstatus **`Floating`** (posisi yang uangnya masih aktif bekerja di pasar).
   * Posisi yang sudah **`Realized`** modalnya telah kembali menjadi saldo kas bebas sehingga **tidak dihitung** sebagai modal masuk aktif:
     $$\text{Total Modal Masuk} = \sum_{\text{status} = \text{'Floating'}} \text{Nominal IDR}$$
2. **Total Laba Bersih Portofolio**:
   $$\text{Total Laba Bersih} = \sum \text{Laba Bersih (Realized)} + \sum \text{Laba Bersih (Floating)}$$
3. **Net ROI Portofolio (\%)**:
   $$\text{Net ROI} = \frac{\text{Total Laba Bersih}}{\text{Total Modal Masuk Aktif}} \times 100$$
4. **Total Nilai Aset Aktif**:
   $$\text{Total Nilai Aset Aktif} = \sum_{\text{status} = \text{'Floating'}} \text{Nilai Aset IDR}$$

### 5.3. Ringkasan Aset Portofolio Aktif (Kolom P:S Google Sheet)
Jika satu aset dibeli berulang kali (misal SPCX dibeli 3 kali):
* **Average Buy Price**: $\frac{\sum (\text{Entry Price} \times \text{Jumlah})}{\sum \text{Jumlah}}$
* **Price Now**: Exit Price terakhir yang tercatat.
* **PnL (\% Aset)**: $\frac{\text{Price Now} - \text{Average Buy}}{\text{Average Buy}} \times 100$
* **Value Total (IDR)**: $\sum \text{Nilai Aset IDR}$

---

## 6. Logika Kurva Pertumbuhan & Chart Visualisasi (Line & Bar)

Komponen `DetailedEquityChart.tsx` mengimplementasikan kurva pertumbuhan berstandar institusional dengan tombol saklar (*toggle*):

### 6.1. Logika Kurva Garis Putih (Line Chart) — *Rekomendasi Utama*:
* **Sumbu X Kronologis Historis**: Murni dibangun dari transaksi yang sudah **`Realized`** diurutkan berdasarkan **`Exit Date`** (bukan Entry Date).
  * *Alasan Finansial*: Laba/rugi baru resmi sah menjadi milik portofolio dan masuk kas pada saat posisi ditutup (**Exit Date**).
* **Titik Terakhir ("Saat Ini / Floating")**: Di ujung kanan kurva ditambahkan 1 titik akumulasi khusus bertanda *dot cyan* yang merangkum seluruh total laba floating aktif.
* **Hasil Akhir Garis**: Kurva mendarat tepat di total keuntungan keseluruhan portofolio.
* **Styling**: Garis putih monokrom (`stroke="#ffffff"`) berbobot 2.5px dengan *glow drop shadow* SVG dan dot penanda *High* & *Low*.

### 6.2. Logika Histogram Batang (Bar Chart):
* Menampilkan diagram batang individual untuk tiap aset.
* **Warna Batang**:
  * Hijau Zamrud (`#10b981`) jika transaksi mencetak **Profit** ($Laba \ge 0$).
  * Merah Rose (`#f43f5e`) jika transaksi mencetak **Loss** ($Laba < 0$).
* **Sub-Metrics**: Menampilkan otomatis **Win Count**, **Loss Count**, **Win Rate (\%)**, dan **Profit Tertinggi**.

---

## 7. Logika Visual Performance Heatmap

Komponen `AssetPerformanceHeatmap.tsx` menyajikan matriks sebaran profitabilitas aset layaknya Finviz/TradingView:

### 7.1. Logika Agregasi per Aset:
Seluruh transaksi dikelompokkan berdasarkan **Ticker Simbol Aset**:
* Dihitung **Weighted ROI (\%)** = $\frac{\sum \text{Laba Bersih Aset}}{\sum \text{Nominal Beli Aset}} \times 100$.
* Dihitung porsi persentase alokasi modal terhadap total portofolio.

### 7.2. Logika Gradien Warna Heatmap:
* **Imbal Hasil Sangat Tinggi ($> +20\%$)**: `bg-emerald-500/20`, border `emerald-500/60`, teks `text-emerald-400` dengan pendaran neon.
* **Imbal Hasil Tinggi ($+10\%$ s/d $+20\%$)**: `bg-emerald-600/15`, border `emerald-500/40`.
* **Imbal Hasil Moderat ($0\%$ s/d $+10\%$)**: `bg-teal-500/10`, border `teal-500/30`.
* **Koreksi Ringan ($-8\%$ s/d $0\%$)**: `bg-amber-500/10`, border `amber-500/30`.
* **Koreksi Dalam ($< -8\%$)**: `bg-rose-500/20`, border `rose-500/50` dengan pendaran merah.

### 7.3. Fitur Interaktif Heatmap:
1. **Filter Cakupan (Scope)**:
   * `[ Semua Aset ]`: Menghitung gabungan Realized + Floating.
   * `[ Floating Saja ]`: Memfilter hanya posisi terbuka aktif.
   * `[ Realized Saja ]`: Memfilter posisi yang sudah selesai/exit.
2. **Fitur Sembunyikan (Collapse/Expand)**:
   * Mengklik tombol **`[ Sembunyikan ]`** melipat seluruh panel heatmap menjadi satu baris navigasi ringkas (*minimal preview bar*).
3. **Mode Kompak (Compact Density)**:
   * Mengklik tombol perkecil tampilan mengubah grid menjadi deretan kartu mini berdensitas tinggi.
4. **Metrik Fokus**: Toggle antara `% ROI` dan `Nominal Rupiah`.

---

## 8. Tabel Rekap Transaksi & Manajemen Modal (CRUD)

Komponen `TradeLedgerTable.tsx`:
* **Pencarian Cepat**: Filter *real-time* berdasarkan simbol aset (NVDA, SPCX, dll), jenis (BUY/SELL), atau tanggal.
* **Filter Status**: Filter cepat antara `Semua Status`, `Realized`, atau `Floating`.
* **Export CSV**: Mengunduh seluruh rekap transaksi langsung dalam bentuk file `.csv`.
* **Operasi CRUD**:
  * Tambah Transaksi (`AddEditTradeModal.tsx`).
  * Edit Baris Transaksi (Otomatis memperbarui Google Sheet baris terkait).
  * Hapus Baris Transaksi (`DeleteConfirmModal.tsx` dengan konfirmasi keamanan).

---

## 9. Standar Desain UI/UX & Tailwind Styling

Desain mengusung konsep **Dark Executive Financial Terminal**:
* **Background Utama**: `#0b0e17` (Deep Obsidian).
* **Card & Surface**: `#10141f` dengan border halus `#1b2234` atau `#1e273d`.
* **Aksen Positif / Untung**: Emerald Green (`#10b981`).
* **Aksen Negatif / Rugi**: Rose Red (`#f43f5e`).
* **Aksen Netral / Sorotan**: Ice Blue (`#38bdf8`) dan Pure White (`#ffffff`).
* **Zero-Pill Discipline**: Tipografi tegas, kontras rasio AA (4.5:1), tidak ada ornamen visual berlebihan.

---

## 10. Panduan Langkah-demi-Langkah Penggabungan ke Website Utama

### Langkah 1: Pasang Dependencies yang Dibutuhkan
Jalankan perintah berikut di project utama Anda:
```bash
npm install recharts lucide-react firebase
```

### Langkah 2: Salin File-File Inti
Salin file-file berikut ke folder `src/` project utama Anda:
1. `src/types.ts`
2. `src/services/googleSheets.ts`
3. `src/services/firebaseAuth.ts`
4. `src/components/DetailedEquityChart.tsx`
5. `src/components/AssetPerformanceHeatmap.tsx`
6. `src/components/TradeLedgerTable.tsx`
7. `src/components/InvestmentDashboard.tsx`
8. `src/components/AddEditTradeModal.tsx`
9. `src/components/DeleteConfirmModal.tsx`
10. `src/components/GoogleSheetSettingsPage.tsx`

### Langkah 3: Konfigurasi Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Aktifkan 2 API berikut:
   * **Google Sheets API**
   * **Google Drive API**
3. Di menu **OAuth Consent Screen**, tambahkan scope:
   * `.../auth/spreadsheets`
   * `.../auth/drive.readonly`
4. Di menu **Credentials**, buat **OAuth 2.0 Client ID** (Web application) dan masukkan domain website Anda pada *Authorized JavaScript origins* dan *Authorized redirect URIs*.

### Langkah 4: Hubungkan ke Routing atau Halaman Project Utama
Di halaman React tempat Anda ingin menampilkan rekap investasi:
```tsx
import { useState } from 'react';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { INITIAL_SAMPLE_RECORDS } from './services/googleSheets';

export default function InvestmentPage() {
  const [records, setRecords] = useState(INITIAL_SAMPLE_RECORDS);
  const [dateFilter, setDateFilter] = useState({ preset: 'ALL' });

  return (
    <div className="min-h-screen bg-[#0b0e17] text-white p-6 space-y-6">
      {/* Dashboard KPI, Heatmap & Chart */}
      <InvestmentDashboard
        records={records}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      {/* Tabel Transaksi */}
      <TradeLedgerTable
        records={records}
        sheetConnected={true}
        sheetTitle="INVESTMENT"
        onOpenAddModal={() => {}}
        onOpenEditModal={() => {}}
        onOpenDeleteModal={() => {}}
      />
    </div>
  );
}
```

---
*Dokumentasi ini dibuat untuk menjamin integrasi yang mulus, aman, dan presisi ke dalam website utama Anda.*
