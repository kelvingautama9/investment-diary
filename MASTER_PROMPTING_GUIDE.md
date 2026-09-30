# 📜 Master Prompting Guide: Rekap Portofolio & Jurnal Investasi Google Sheets

Dokumen ini berisi panduan instruksi prompt (*Master System Prompt*) terstruktur dan kronologis lengkap dari seluruh siklus pengerjaan proyek dari awal hingga akhir. Anda dapat menggunakan prompt-prompt ini untuk mereplikasi, mengembangkan, atau menginstruksikan AI lain dalam membangun sistem serupa.

---

## 📑 Daftar Isi Prompt
1. [Kronologi & Alur Evolusi Proyek](#1-kronologi--alur-evolusi-proyek)
2. [Master Prompt 1: Arsitektur Utama & Koneksi Google Sheets](#master-prompt-1-arsitektur-utama--koneksi-google-sheets)
3. [Master Prompt 2: Engine Solver Format Angka Indonesia (Locale Parsing)](#master-prompt-2-engine-solver-format-angka-indonesia-locale-parsing)
4. [Master Prompt 3: Logika Akuntansi & Manajemen Modal (Realized vs Floating)](#master-prompt-3-logika-akuntansi--manajemen-modal-realized-vs-floating)
5. [Master Prompt 4: Kurva Pertumbuhan Ekuitas (Line Chart Garis Putih & Toggle Bar)](#master-prompt-4-kurva-pertumbuhan-ekuitas-line-chart-garis-putih--toggle-bar)
6. [Master Prompt 5: Visual Performance Heatmap (Peta Sebaran Kinerja Aset)](#master-prompt-5-visual-performance-heatmap-peta-sebaran-kinerja-aset)
7. [Master Prompt 6: Desain UI/UX Dark Executive Financial Terminal](#master-prompt-6-desain-uiux-dark-executive-financial-terminal)
8. [Master Prompt All-in-One (Mega Prompt Siap Pakai)](#master-prompt-all-in-one-mega-prompt-siap-pakai)

---

## 1. Kronologi & Alur Evolusi Proyek

Berikut rekap perjalanan kebutuhan yang telah diselesaikan secara bertahap:

| Tahap | Kebutuhan Pengguna | Solusi Teknis yang Dikerjakan |
| :---: | :--- | :--- |
| **1** | **Integrasi Google Sheets** | Membangun autentikasi OAuth2 client-side, membaca tab `INVESTMENT`, dan menghubungkan data tabel A2:N50. |
| **2** | **Koreksi Logika Modal Masuk** | Modal aktif HANYA dihitung dari posisi yang masih `Floating`. Posisi `Realized` modalnya sudah kembali ke kas sehingga tidak dihitung sebagai modal aktif berjalan. |
| **3** | **Diskusi Bentuk Visualisasi Chart** | Membandingkan objektif Line Chart, Bar Chart, dan Candlestick Chart untuk portofolio. Menolak Candlestick karena data berupa rekap transaksi, bukan pergerakan harga pasar OHLC. |
| **4** | **Implementasi Kurva Pertumbuhan & Bar Toggle** | Menerapkan Line Chart garis putih mulus berbasis **Tanggal Exit** untuk data Realized + titik akumulasi **"Saat Ini (Floating)"** di ujung kanan. Menambahkan saklar toggle ke Bar Chart (Histogram Profit/Loss). |
| **5** | **Fixing Bug Parsing Format Angka Indonesia** | Memperbaiki masalah data terpotong angka nolnya dari baris WDC ke bawah (`Rp -708.007` terbaca `-708`). Mengembangkan `parseIndonesianNumber` yang membedakan ribuan (titik) dan desimal (koma). |
| **6** | **Visual Performance Heatmap** | Menambahkan heatmap matriks profitabilitas aset layaknya Finviz/TradingView dengan gradien warna dinamis, metrik ROI/Rupiah, dan sorting. |
| **7** | **Filter Realized & Fitur Sembunyikan/Kompak pada Heatmap** | Menambahkan opsi cakupan `Realized Saja`, tombol lipat/sembunyikan (*collapse/expand*), dan tombol perkecil tampilan (*compact density*). |
| **8** | **Dokumentasi Integrasi** | Menyusun `INTEGRATION_GUIDE.md` untuk mempermudah pemindahan fitur ke website utama. |

---

## Master Prompt 1: Arsitektur Utama & Koneksi Google Sheets

Gunakan prompt ini untuk menginisiasi arsitektur dasar dan integrasi REST API Google Sheets:

```markdown
Bertindaklah sebagai Senior Full-Stack Engineer. Saya ingin membangun aplikasi Web Dashboard Rekap Transaksi Investasi yang terhubung langsung dengan Google Sheets pengguna menggunakan React, TypeScript, dan Tailwind CSS.

Persyaratan Integrasi:
1. Hubungkan autentikasi Google menggunakan OAuth2 client-side (Google Identity Services / Firebase Auth) dengan scope:
   - https://www.googleapis.com/auth/spreadsheets
   - https://www.googleapis.com/auth/drive.readonly
2. Buat service `googleSheets.ts` yang mampu:
   - Mengambil metadata spreadsheet dan mendeteksi tab bernama "INVESTMENT" atau "Invest".
   - Melakukan pembacaan data baris A2:N50 melalui REST API v4.
   - Menyediakan fungsi CRUD lengkap: membaca baris (fetch), menambah baris baru (append), memperbarui baris (update), dan menghapus baris (delete row via batchUpdate).
3. Buat UI Header yang menampilkan status sinkronisasi ("Google Sheet Tersambung"), tombol "Sinkron Sekarang", dan user profile session.
4. Buat tabel buku besar transaksi (Trade Ledger Table) dengan fitur pencarian, filter status (All / Realized / Floating), dan kemampuan ekspor ke file CSV.
```

---

## Master Prompt 2: Engine Solver Format Angka Indonesia (Locale Parsing)

Gunakan prompt ini jika menghadapi masalah pembacaan format mata uang Rupiah Indonesia dari Google Sheets:

```markdown
Bertindaklah sebagai Senior Financial Software Engineer. Buat fungsi parser angka cerdas di TypeScript bernama `parseIndonesianNumber` untuk menangani keunikan format regional Google Sheets Indonesia:

Konteks Masalah:
- Format Indonesia menggunakan tanda titik (.) sebagai pemisah ribuan (contoh: "Rp 10.000.000", "Rp -708.007", "17.890").
- Format Indonesia menggunakan tanda koma (,) sebagai pemisah desimal (contoh: "0,635", "18,25%", "207,7").
- Jangan biarkan angka di bawah Rp 1.000.000 yang hanya memiliki 1 tanda titik (seperti "Rp -708.007" atau "Rp 431.425") keliru diparsing sebagai angka desimal pecahan (-708.007) yang menyebabkannya terpotong menjadi -708.

Aturan Parser:
1. Parameter: `parseIndonesianNumber(val: any, options?: { isCurrency?: boolean; isKurs?: boolean; isDecimal?: boolean }): number`.
2. Jika string memiliki "Rp" atau `isCurrency: true`, SEMUA tanda titik (.) adalah pemisah ribuan mutlak. Hapus semua titik sebelum parseFloat.
3. Jika kolom adalah Kurs IDR-USD (`isKurs: true`), format "17.890" harus diparsing utuh menjadi integer 17890.
4. Jika string memiliki tanda koma (,) dan tanpa titik, ganti koma menjadi titik untuk desimal standar (contoh: "0,635" -> 0.635).
5. Jika memiliki titik dan koma sekaligus (contoh: "2.630.000,0"), hapus titik dan jadikan koma sebagai titik desimal -> 2630000.
```

---

## Master Prompt 3: Logika Akuntansi & Manajemen Modal (Realized vs Floating)

Gunakan prompt ini untuk memastikan rumus finansial dan kartu metrik KPI portofolio dihitung secara presisi:

```markdown
Implementasikan logika finansial dan akuntansi portofolio investasi pada komponen dashboard dengan aturan ketat berikut:

1. Formula Tiap Baris Transaksi:
   - Effective Price = Exit Price > 0 ? Exit Price : Entry Price
   - PnL (%) = ((Effective Price - Entry Price) / Entry Price) * 100
   - Spread Cost (0.5%) Broker = -(Nominal IDR * 0.005)
   - Laba Bersih IDR = (Nominal IDR * (PnL % / 100)) + Spread Cost
   - Nilai Aset IDR = Status === 'Floating' ? (Nominal IDR + Laba Bersih) : 0

2. Aturan Perhitungan Kartu Ringkasan (KPI Cards):
   - TOTAL MODAL MASUK: HANYA jumlahkan transaksi yang berstatus 'Floating' (posisi aktif yang dananya sedang bekerja di pasar). Transaksi yang berstatus 'Realized' modalnya sudah kembali ke kas bebas, JANGAN dihitung sebagai modal aktif berjalan.
   - TOTAL LABA BERSIH: Jumlahkan seluruh Laba Bersih (akumulasi Realized + Floating).
   - NET ROI (%): (Total Laba Bersih / Total Modal Masuk Aktif) * 100.
   - TOTAL NILAI ASET AKTIF: Jumlahkan seluruh Nilai Aset IDR dari posisi berstatus 'Floating'.

3. Ringkasan Aset Portofolio Aktif (Tabel Kolom P:S):
   - Kelompokkan aset yang memiliki posisi Floating ganda (misal SPCX dibeli beberapa kali).
   - Hitung Weighted Average Buy Price = Total Biaya Pembelian / Total Lot.
   - Price Now = Exit Price terakhir.
   - PnL (%) Aset = ((Price Now - Average Buy) / Average Buy) * 100.
   - Value Total IDR = Total nilai valuasi terkini aset tersebut.
```

---

## Master Prompt 4: Kurva Pertumbuhan Ekuitas (Line Chart Garis Putih & Toggle Bar)

Gunakan prompt ini untuk membuat grafik pertumbuhan modal berstandar hedge-fund:

```markdown
Bangun komponen grafik pertumbuhan portofolio `DetailedEquityChart.tsx` menggunakan Recharts dengan spesifikasi:

1. Jangan gunakan Candlestick Chart untuk rekap transaksi akun, gunakan kombinasi Kurva Garis (Line) dan Histogram Batang (Bar).
2. Sediakan tombol saklar (Toggle) di header grafik:
   - [ Kurva Akumulasi (Line) ]
   - [ Hasil Per Transaksi (Bar) ]

3. Logika Kurva Akumulasi (Line Chart):
   - Sumbu X masa lalu murni dibangun dari transaksi yang berstatus 'Realized', diurutkan kronologis berdasarkan 'Exit Date' (kapan laba/rugi resmi terkunci dan masuk kas).
   - Di ujung kanan kurva, tambahkan 1 titik penutup khusus bertanda dot biru ("Saat Ini / Floating") yang menambahkan total laba dari posisi floating aktif, sehingga garis berakhir tepat di Total Laba Bersih portofolio.
   - Garis Line berwarna PUTIH BERSIH (#ffffff) monokrom dengan glow drop shadow SVG, dot grid latar belakang, dan dot highlight pada titik High, Low, dan Terkini.
   - Tooltip menampilkan akumulasi laba berjalan, laba per transaksi, tanggal exit, dan status.

4. Logika Hasil Per Transaksi (Bar Chart):
   - Menampilkan diagram batang individual tiap transaksi.
   - Batang HIJAU (#10b981) untuk transaksi untung/profit.
   - Batang MERAH (#f43f5e) untuk transaksi rugi/loss.
   - Sub-stats otomatis menampilkan metrik performa: Total Win, Total Loss, Win Rate %, dan Transaksi Terbaik.
```

---

## Master Prompt 5: Visual Performance Heatmap (Peta Sebaran Kinerja Aset)

Gunakan prompt ini untuk membangun visualisasi treemap/heatmap profitabilitas aset:

```markdown
Buat komponen `AssetPerformanceHeatmap.tsx` yang memvisualisasikan sebaran profitabilitas aset layaknya Finviz atau TradingView:

1. Agregasi Aset:
   - Kelompokkan semua transaksi berdasarkan simbol aset (SPCX, GOLD, NVDA, QQQ, MSFT, WDC, QCOM, MSTR).
   - Hitung Weighted ROI (%) dan Total Laba Bersih IDR untuk setiap aset.
   - Hitung porsi persentase modal aset terhadap total modal portofolio.

2. Gradien Warna Performa Dinamis:
   - ROI > +20%: Glowing Emerald Green (bg-emerald-500/20, border-emerald-500/60)
   - ROI +10% s/d +20%: Medium Emerald (bg-emerald-600/15, border-emerald-500/40)
   - ROI 0% s/d +10%: Teal Green (bg-teal-500/10, border-teal-500/30)
   - ROI -8% s/d 0%: Soft Amber/Rose (bg-amber-500/10, border-amber-500/30)
   - ROI < -8%: Deep Rose Red (bg-rose-500/20, border-rose-500/50)

3. Kontrol & Navigasi:
   - Scope Filter: Sediakan 3 tombol pilihan: [ Semua Aset ] | [ Floating Saja ] | [ Realized Saja ].
   - Metric Toggle: Pilihan fokus antara persentase [ % ] atau nominal Rupiah [ $ ].
   - Sorting: Pilihan urut berdasarkan "ROI Tertinggi", "ROI Terendah", atau "Modal Terbesar".

4. Fitur Sembunyikan & Perkecil Tampilan:
   - Sediakan tombol [ Sembunyikan / Buka Heatmap ] (Collapse/Expand) yang melipat seluruh panel heatmap menjadi satu baris navigasi ringkas (*minimal preview bar*).
   - Sediakan tombol [ Perkecil Tampilan ] (Compact Density) yang mengubah ukuran kartu menjadi kartu mini berdensitas tinggi agar seluruh aset muat dalam deretan rapi.
```

---

## Master Prompt 6: Desain UI/UX Dark Executive Financial Terminal

Gunakan prompt ini untuk memastikan estetika visual bernuansa premium, profesional, dan anti-AI slop:

```markdown
Terapkan panduan desain antarmuka (*UI/UX Design Constitution*) dengan standar terminal keuangan eksekutif modern:

1. Palet Warna:
   - Canvas/Background: Deep Obsidian Dark (#0b0e17)
   - Cards/Surfaces: Deep Slate Navy (#10141f) dengan border halus (#1b2234)
   - Status Untung/Cuan: Emerald Green (#10b981)
   - Status Rugi/Loss: Rose Red (#f43f5e)
   - Highlight & Aksen: Electric Sky Blue (#38bdf8) dan Pure White (#ffffff)

2. Tipografi & Hirarki:
   - Angka metrik keuangan berukuran besar, tebal (font-extrabold), dan diformat pemisah ribuan standar Indonesia (contoh: Rp 17.719.000).
   - Hindari static pill wrappers yang tidak fungsional; gunakan tipografi teks bersih dengan separator halus (· / •).
   - Setiap elemen interaktif harus memiliki hover state yang halus dan responsif di mobile maupun desktop.
```

---

## Master Prompt All-in-One (Mega Prompt Siap Pakai)

Jika Anda ingin langsung memberikan **satu prompt lengkap** kepada AI atau tim engineer untuk membangun keseluruhan sistem dalam satu tarikan perintah, gunakan prompt berikut:

```markdown
Buatkan aplikasi lengkap "Google Sheets Investment & Trading Portfolio Dashboard" berbasis React, TypeScript, Tailwind CSS, dan Recharts dengan spesifikasi arsitektur dan bisnis sebagai berikut:

1. INTEGRASI GOOGLE SHEETS API:
   - Autentikasi Google OAuth2 client-side (scope: spreadsheets & drive.readonly).
   - Sinkronisasi dua arah dengan Google Sheets (tab 'INVESTMENT' baris A2:N50).
   - Fitur CRUD lengkap: membaca, menambah transaksi baru, mengedit baris, dan menghapus baris.

2. LOCALE PARSER FORMAT INDONESIA:
   - Kembangkan fungsi `parseIndonesianNumber` yang mengenali tanda titik (.) pada mata uang Rupiah sebagai pemisah ribuan mutlak (contoh: "Rp -708.007", "Rp 431.425", "Rp -58.302", "17.890" Kurs IDR-USD). Jangan memotong angka nol menjadi angka desimal pecahan.
   - Kolom koma (,) diparsing sebagai desimal standar ("0,635" -> 0.635).

3. LOGIKA AKUNTANSI & PORTOFOLIO:
   - Formula transaksi: Laba Bersih = (Nominal * PnL%) - (Nominal * 0.005 Spread).
   - Total Modal Masuk: HANYA menjumlahkan transaksi dengan status 'Floating' (posisi terbuka). Transaksi berstatus 'Realized' modalnya sudah bebas di kas sehingga tidak dihitung sebagai modal aktif berjalan.
   - Total Laba Bersih: Akumulasi Realized + Floating.
   - Ringkasan Aset Aktif P:S: Menghitung Weighted Average Buy, Price Now, dan Total Valuasi IDR.

4. DETAILED EQUITY CHART:
   - Menyediakan saklar toggle [ Kurva Akumulasi (Line) ] dan [ Hasil Per Transaksi (Bar) ].
   - Line Chart: Sumbu X masa lalu murni dibangun dari transaksi Realized berdasarkan Exit Date + 1 titik penutup di kanan ("Saat Ini / Floating") yang menambahkan laba floating berjalan. Garis berwarna putih mulus dengan glowing shadow SVG.
   - Bar Chart: Histogram batang hijau untuk profit dan merah untuk loss, dilengkapi metrik Win Rate dan Profit Tertinggi.

5. PERFORMANCE HEATMAP:
   - Matriks visual sebaran kinerja aset dengan gradien warna intensitas performa (Emerald Glow > +20%, Medium Emerald +10-20%, Teal 0-10%, Amber -8-0%, Rose < -8%).
   - Dilengkapi filter cakupan: [ Semua Aset ] | [ Floating Saja ] | [ Realized Saja ].
   - Dilengkapi tombol [ Sembunyikan / Buka Heatmap ] (Collapse) dan tombol [ Perkecil Tampilan ] (Compact Mode).

6. DESAIN UI/UX:
   - Tema Dark Executive Financial Terminal (#0b0e17 canvas, #10141f cards, border #1b2234).
   - Tabel transaksi interaktif dengan pencarian, filter status, dan tombol unduh CSV.
```

---
*Dokumen ini dibuat sebagai acuan dokumentasi prompt resmi dari sistem Rekap Investasi.*
