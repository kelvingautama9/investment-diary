import type { InvestmentRecord, TradeType, TradeStatus } from '../types';

export const SHEET_NAME = 'INVESTMENT';

export const SHEET_HEADERS = [
  'Type',
  'Asset',
  'Nominal (IDR)',
  'Kurs IDR-USD',
  'Jumlah',
  'Entry Date',
  'Exit Date',
  'Entry Price',
  'Exit Price',
  'PnL',
  'SPREAD 0.5%',
  'Laba Bersih',
  'Notes',
  'Nilai Aset',
];

export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (match && match[1]) {
    return match[1];
  }
  const clean = trimmed.split(/[/\\?#]/)[0];
  if (/^[a-zA-Z0-9_-]{20,65}$/.test(clean)) {
    return clean;
  }
  return trimmed;
}

export function extractGidFromUrl(input: string): string | null {
  if (!input) return null;
  const match = input.match(/[#?&]gid=([0-9]+)/);
  return match ? match[1] : null;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export async function listUserSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  try {
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=15`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Error fetching drive spreadsheets:', err);
    return [];
  }
}

// Helper to parse localized numbers (supports Indonesian sheet formats)
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

  // Strip "Rp", spaces, and "%"
  let cleaned = str.replace(/[^\d.,\-]/g, '');
  if (!cleaned) return 0;

  // Case 1: Has both dot and comma, e.g. "2.630.000,0" or "10.000.000,00"
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Dot is thousands separator, comma is decimal separator
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // Case 2: Only has comma, e.g. "0,635", "18,25%", "207,7", "389,6"
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // Case 3: Has dot(s) and NO comma
  if (cleaned.includes('.')) {
    // A) If it's currency (has "Rp" or isCurrency is true), dots are ALWAYS thousands separators
    // e.g. "Rp -708.007", "Rp 431.425", "Rp -58.302", "Rp 10.000.000", "Rp -59.243"
    if (isCurrency) {
      cleaned = cleaned.replace(/\./g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    // B) If it's Kurs (IDR-USD), e.g. "17.890", "18.140", "17.716"
    if (isKurs) {
      cleaned = cleaned.replace(/\./g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    // C) If explicitly marked as decimal (e.g. quantity/percentage), dot is decimal
    if (isDecimal) {
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    // D) General check: if multiple dots, e.g. "10.000.000", dots are thousands
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = cleaned.replace(/\./g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    // If single dot and trailing part has exactly 3 digits (standard thousands in IDR like "708.007")
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
      cleaned = cleaned.replace(/\./g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Comprehensive blacklist of expense/budget/non-investment categories
const EXCLUDED_EXPENSE_KEYWORDS = [
  'TRANSPORT',
  'TRANSPORTASI',
  'KENDARAAN',
  'BENSIN',
  'ONGKOS',
  'GRAB',
  'GOJEK',
  'UBER',
  'TIKET',
  'TAKSI',
  'PARKIR',
  'TOL',
  'TOLL',
  'MAKAN',
  'MAKANAN',
  'FOOD',
  'KULINER',
  'RESTO',
  'CAFE',
  'MINUM',
  'LUNCH',
  'DINNER',
  'EXPENSE',
  'PENGELUARAN',
  'BIAYA',
  'TAGIHAN',
  'BILLS',
  'LISTRIK',
  'PLN',
  'AIR',
  'PDAM',
  'PULSA',
  'KUOTA',
  'INTERNET',
  'WIFI',
  'KOS',
  'KOST',
  'SEWA',
  'RENT',
  'GAJI',
  'SALARY',
  'BONUS',
  'THR',
  'BELANJA',
  'SHOPPING',
  'SUPERMARKET',
  'MINIMARKET',
  'INDOMARET',
  'ALFAMART',
  'ASURANSI',
  'INSURANCE',
  'PAJAK',
  'TAX',
  'ADMIN',
  'FEE',
  'MUTASI',
  'TRANSFER',
  'TARIK TUNAI',
  'TOP UP',
  'TOPUP',
  'DEPOSIT',
  'WITHDRAW',
  'SALDO',
  'TOTAL',
  'SUBTOTAL',
  'GRAND TOTAL',
  'AVERAGE',
  'RATA-RATA',
  'NOTE',
  'NOTES',
  'KETERANGAN',
  'SPEND',
];

export function isNonInvestmentOrExpense(text?: string | null): boolean {
  if (!text) return true;
  const upper = String(text).trim().toUpperCase();
  if (upper.length <= 1) return true;
  if (upper === 'ASSET' || upper === 'TYPE' || upper === 'TANGGAL' || upper === 'DATE' || upper === '-' || upper === '.') return true;

  // Substring check for all forbidden expense keywords
  return EXCLUDED_EXPENSE_KEYWORDS.some(kw => upper.includes(kw));
}

export function isValidInvestmentTrade(
  typeRaw: string,
  asset: string,
  nominalIdr: number,
  jumlah: number,
  entryPrice: number
): boolean {
  if (!asset || asset.trim().length <= 1) return false;
  if (isNonInvestmentOrExpense(asset)) return false;
  if (isNonInvestmentOrExpense(typeRaw)) return false;

  const upperType = typeRaw.trim().toUpperCase();
  // Must be BUY, SELL, BELI, or JUAL
  const isBuy = upperType === 'BUY' || upperType === 'BELI';
  const isSell = upperType === 'SELL' || upperType === 'JUAL';
  if (!isBuy && !isSell) return false;

  // Must have capital invested > 0 or quantity > 0
  if (nominalIdr <= 0 && (jumlah <= 0 || entryPrice <= 0)) {
    return false;
  }

  return true;
}

// Convert date from "5-Jan-2026" or "2026-01-05" into YYYY-MM-DD
function parseDateToIso(dateStr: string): string {
  if (!dateStr || dateStr.includes('dd/mm/yyyy')) return '';
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
    jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10',
    oct: '10', nov: '11', des: '12', dec: '12',
  };

  const parts = dateStr.trim().split(/[-/\s]/);
  if (parts.length === 3) {
    // Check if parts[1] is a month name
    const mKey = parts[1].toLowerCase().slice(0, 3);
    if (monthMap[mKey]) {
      const day = parts[0].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${monthMap[mKey]}-${day}`;
    }
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }

  return dateStr;
}

function isRestrictedAccessText(text: string, status?: number): boolean {
  if (status === 401 || status === 403 || status === 404) return true;
  return (
    text.includes('Page not found') ||
    text.includes('google.com/start/apps') ||
    text.includes('Sorry, the file you have requested does not exist') ||
    text.includes('ServiceLogin') ||
    text.includes('accounts.google.com') ||
    text.includes('Access Denied') ||
    text.includes('Sign in to continue') ||
    (text.includes('<html') && text.includes('Sign in'))
  );
}

interface ColumnMapping {
  typeIdx: number;
  assetIdx: number;
  nominalIdx: number;
  kursIdx: number;
  jumlahIdx: number;
  entryDateIdx: number;
  exitDateIdx: number;
  entryPriceIdx: number;
  exitPriceIdx: number;
  pnlIdx: number;
  spreadIdx: number;
  labaBersihIdx: number;
  statusIdx: number;
  nilaiAsetIdx: number;
}

function detectColumnMapping(headers: string[]): { mapping: ColumnMapping; detected: boolean } {
  const norm = headers.map(h => String(h || '').trim().toLowerCase());

  const findIdx = (keywords: string[]) => {
    return norm.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const assetIdx = findIdx(['asset', 'aset', 'ticker', 'symbol', 'simbol', 'saham', 'koin']);
  const nominalIdx = findIdx(['nominal', 'modal', 'investasi', 'capital', 'total idr', 'cost', 'amount']);

  if (assetIdx === -1 && nominalIdx === -1) {
    return {
      mapping: {
        typeIdx: 0,
        assetIdx: 1,
        nominalIdx: 2,
        kursIdx: 3,
        jumlahIdx: 4,
        entryDateIdx: 5,
        exitDateIdx: 6,
        entryPriceIdx: 7,
        exitPriceIdx: 8,
        pnlIdx: 9,
        spreadIdx: 10,
        labaBersihIdx: 11,
        statusIdx: 12,
        nilaiAsetIdx: 13,
      },
      detected: false,
    };
  }

  const typeIdx = findIdx(['type', 'tipe', 'action', 'side', 'jenis', 'beli/jual']);
  const kursIdx = findIdx(['kurs', 'rate', 'usd-idr', 'idr-usd']);
  const jumlahIdx = findIdx(['jumlah', 'qty', 'volume', 'lot', 'unit', 'shares', 'quantity']);
  const entryDateIdx = findIdx(['entry date', 'tgl beli', 'tanggal beli', 'open date', 'tgl masuk', 'entry', 'date', 'tanggal']);
  const exitDateIdx = findIdx(['exit date', 'tgl jual', 'tanggal jual', 'close date', 'tgl keluar', 'exit']);
  const entryPriceIdx = findIdx(['entry price', 'harga beli', 'buy price', 'harga entry', 'open price']);
  const exitPriceIdx = findIdx(['exit price', 'harga jual', 'sell price', 'harga exit', 'close price', 'current price', 'harga saat ini']);
  const pnlIdx = findIdx(['pnl', 'roi', 'laba %', 'profit %', 'return', 'untung %']);
  const spreadIdx = findIdx(['spread', 'fee', 'biaya']);
  const labaBersihIdx = findIdx(['laba bersih', 'net profit', 'net pnl', 'laba/rugi', 'profit', 'laba']);
  const statusIdx = findIdx(['status', 'posisi', 'kondisi', 'state']);
  const nilaiAsetIdx = findIdx(['nilai aset', 'market value', 'current value', 'total nilai']);

  return {
    mapping: {
      typeIdx: typeIdx !== -1 ? typeIdx : 0,
      assetIdx: assetIdx !== -1 ? assetIdx : 1,
      nominalIdx: nominalIdx !== -1 ? nominalIdx : 2,
      kursIdx: kursIdx !== -1 ? kursIdx : 3,
      jumlahIdx: jumlahIdx !== -1 ? jumlahIdx : 4,
      entryDateIdx: entryDateIdx !== -1 ? entryDateIdx : 5,
      exitDateIdx: exitDateIdx !== -1 ? exitDateIdx : 6,
      entryPriceIdx: entryPriceIdx !== -1 ? entryPriceIdx : 7,
      exitPriceIdx: exitPriceIdx !== -1 ? exitPriceIdx : 8,
      pnlIdx: pnlIdx !== -1 ? pnlIdx : 9,
      spreadIdx: spreadIdx !== -1 ? spreadIdx : 10,
      labaBersihIdx: labaBersihIdx !== -1 ? labaBersihIdx : 11,
      statusIdx: statusIdx !== -1 ? statusIdx : 12,
      nilaiAsetIdx: nilaiAsetIdx !== -1 ? nilaiAsetIdx : 13,
    },
    detected: true,
  };
}

// Helper to parse standard CSV format from Google Sheets export
function parseCsvToRows(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows: string[][] = [];
  for (const line of lines) {
    const row: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

// Zero-Auth Public Google Sheet Fetcher via GViz API & CSV Export (Requires ZERO login, ZERO Firebase, ZERO setup)
export async function fetchInvestmentRecordsViaGviz(
  spreadsheetId: string,
  preferredSheetName?: string
): Promise<{ records: InvestmentRecord[]; title: string; tabExists: boolean }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('ID Spreadsheet tidak valid.');
  }

  const explicitGid = extractGidFromUrl(spreadsheetId);

  // Candidate tabs to try in priority order
  const candidateTabs = Array.from(new Set([
    preferredSheetName?.trim(),
    'INVESTMENT',
    'Investasi',
    'Portofolio',
    'Portfolio',
    'Sheet1',
    'Lembar1',
    'Rekap',
    'Data',
  ])).filter(Boolean) as string[];

  let rawJson: any = null;
  let activeTabName = preferredSheetName || SHEET_NAME;
  let lastError = '';

  // 1. If explicit GID was in URL, try it first via GViz
  if (explicitGid) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&gid=${explicitGid}`;
      const res = await fetch(url);
      const text = await res.text();
      if (isRestrictedAccessText(text, res.status)) throw new Error('RESTRICTED_ACCESS');
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed?.table && parsed.table.rows && parsed.table.rows.length > 0) {
          rawJson = parsed;
          activeTabName = `gid-${explicitGid}`;
        }
      }
    } catch (e: any) {
      if (e?.message === 'RESTRICTED_ACCESS') throw e;
    }
  }

  // 2. Try named tabs via GViz
  if (!rawJson?.table) {
    for (const tab of candidateTabs) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
        const res = await fetch(url);
        const text = await res.text();

        if (isRestrictedAccessText(text, res.status)) {
          throw new Error('RESTRICTED_ACCESS');
        }

        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (match && match[1]) {
          const parsed = JSON.parse(match[1]);
          if (parsed?.status === 'error') {
            continue;
          }
          if (parsed?.table && parsed.table.rows && parsed.table.rows.length > 0) {
            rawJson = parsed;
            activeTabName = tab;
            break;
          }
        }
      } catch (e: any) {
        if (e?.message === 'RESTRICTED_ACCESS') throw e;
        lastError = e?.message || 'Network error';
      }
    }
  }

  // 3. Fallback to default first tab via GViz
  if (!rawJson?.table) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json`;
      const res = await fetch(url);
      const text = await res.text();

      if (isRestrictedAccessText(text, res.status)) {
        throw new Error('RESTRICTED_ACCESS');
      }

      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed?.table) {
          rawJson = parsed;
          activeTabName = 'Sheet1';
        }
      }
    } catch (e: any) {
      if (e?.message === 'RESTRICTED_ACCESS') throw e;
      lastError = e?.message || 'Network error';
    }
  }

  // 4. Additional Fallback: Direct CSV Export Endpoint (High compatibility for public sheets)
  if (!rawJson?.table) {
    for (const tab of candidateTabs) {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv&sheet=${encodeURIComponent(tab)}`;
        const res = await fetch(csvUrl);
        const text = await res.text();
        if (isRestrictedAccessText(text, res.status)) {
          throw new Error('RESTRICTED_ACCESS');
        }
        if (res.ok && text && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
          const csvRows = parseCsvToRows(text);
          if (csvRows.length > 1) {
            rawJson = {
              table: {
                rows: csvRows.map(row => ({
                  c: row.map(val => ({ v: val, f: val })),
                })),
              },
            };
            activeTabName = tab;
            break;
          }
        }
      } catch (e: any) {
        if (e?.message === 'RESTRICTED_ACCESS') throw e;
      }
    }
  }

  // 5. Final Fallback: Default CSV Export (First tab)
  if (!rawJson?.table) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`;
      const res = await fetch(csvUrl);
      const text = await res.text();
      if (isRestrictedAccessText(text, res.status)) {
        throw new Error('RESTRICTED_ACCESS');
      }
      if (res.ok && text && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
        const csvRows = parseCsvToRows(text);
        if (csvRows.length > 1) {
          rawJson = {
            table: {
              rows: csvRows.map(row => ({
                c: row.map(val => ({ v: val, f: val })),
              })),
            },
          };
          activeTabName = 'Sheet1';
        }
      }
    } catch (e: any) {
      if (e?.message === 'RESTRICTED_ACCESS') throw e;
    }
  }

  if (!rawJson?.table) {
    if (lastError.includes('RESTRICTED') || lastError.includes('404')) {
      throw new Error('RESTRICTED_ACCESS');
    }
    throw new Error(`Tidak dapat membaca Google Sheet: ${lastError || 'Pastikan akses diubah ke "Siapa saja yang memiliki link"'}`);
  }

  const table = rawJson.table;
  const rows = table.rows || [];

  // Detect header row and column mapping across the first 5 rows
  let startIndex = 0;
  let headerRowStrings: string[] = [];

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const rCells = rows[r]?.c || [];
    const rStrings = rCells.map((cell: any) => String(cell?.f ?? cell?.v ?? ''));
    const combined = rStrings.join(' ').toUpperCase();

    if (
      (combined.includes('TYPE') || combined.includes('TIPE') || combined.includes('ACTION')) &&
      (combined.includes('ASSET') || combined.includes('ASET') || combined.includes('TICKER') || combined.includes('SIMBOL'))
    ) {
      startIndex = r + 1;
      headerRowStrings = rStrings;
      break;
    }

    if (
      combined.includes('ASSET') ||
      combined.includes('ASET') ||
      combined.includes('NOMINAL') ||
      combined.includes('TANGGAL') ||
      combined.includes('DATE')
    ) {
      if (headerRowStrings.length === 0) {
        startIndex = r + 1;
        headerRowStrings = rStrings;
      }
    }
  }

  const { mapping } = detectColumnMapping(headerRowStrings);
  const records: InvestmentRecord[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const c = rows[i]?.c || [];
    const getVal = (idx: number) => {
      const cell = c[idx];
      if (!cell) return '';
      return cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : '');
    };

    let typeRaw = String(getVal(mapping.typeIdx) || '').trim().toUpperCase();
    const asset = String(getVal(mapping.assetIdx) || '').trim().toUpperCase();
    const nominalIdr = parseIndonesianNumber(getVal(mapping.nominalIdx), { isCurrency: true });
    const kursIdrUsd = parseIndonesianNumber(getVal(mapping.kursIdx), { isKurs: true });
    const jumlah = parseIndonesianNumber(getVal(mapping.jumlahIdx), { isDecimal: true });
    const entryPrice = parseIndonesianNumber(getVal(mapping.entryPriceIdx));

    // Default type to BUY if empty or unrecognized but has valid asset
    if (!typeRaw || (!typeRaw.includes('BUY') && !typeRaw.includes('SELL') && !typeRaw.includes('BELI') && !typeRaw.includes('JUAL'))) {
      typeRaw = 'BUY';
    }

    if (!isValidInvestmentTrade(typeRaw, asset, nominalIdr, jumlah, entryPrice)) {
      continue;
    }

    const typeStr: TradeType = (typeRaw === 'SELL' || typeRaw === 'JUAL') ? 'SELL' : 'BUY';
    const entryDate = parseDateToIso(String(getVal(mapping.entryDateIdx) || ''));
    const exitDateRaw = String(getVal(mapping.exitDateIdx) || '');
    const exitDate = exitDateRaw && !exitDateRaw.includes('dd/mm/yyyy') ? parseDateToIso(exitDateRaw) : undefined;
    const exitPriceRaw = getVal(mapping.exitPriceIdx);
    const exitPrice = exitPriceRaw ? parseIndonesianNumber(exitPriceRaw) : undefined;
    let pnlPercent = parseIndonesianNumber(getVal(mapping.pnlIdx), { isDecimal: true });
    const spreadCost = parseIndonesianNumber(getVal(mapping.spreadIdx), { isCurrency: true });
    let labaBersih = parseIndonesianNumber(getVal(mapping.labaBersihIdx), { isCurrency: true });
    const rawStatus = String(getVal(mapping.statusIdx) || '').trim();
    let status: TradeStatus = rawStatus.toLowerCase().includes('realized') ? 'Realized' : 'Floating';
    if (!rawStatus && exitDate) status = 'Realized';
    let nilaiAset = parseIndonesianNumber(getVal(mapping.nilaiAsetIdx), { isCurrency: true });

    // Auto-calculate missing metrics if formula was absent
    if (!pnlPercent && entryPrice > 0 && exitPrice && exitPrice > 0) {
      pnlPercent = Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2));
    }
    if (!labaBersih && entryPrice > 0 && exitPrice && exitPrice > 0 && jumlah > 0) {
      const multiplier = kursIdrUsd > 100 ? kursIdrUsd : 1;
      labaBersih = Math.round((exitPrice - entryPrice) * jumlah * multiplier);
    }
    if (!nilaiAset && jumlah > 0) {
      const p = exitPrice || entryPrice;
      const multiplier = kursIdrUsd > 100 ? kursIdrUsd : 1;
      nilaiAset = Math.round(p * jumlah * multiplier);
    }

    records.push({
      id: `ROW-${i + 2}`,
      rowNumber: i + 2,
      type: typeStr,
      asset,
      nominalIdr,
      kursIdrUsd,
      jumlah,
      entryDate,
      exitDate,
      entryPrice,
      exitPrice,
      pnlPercent,
      spreadCost,
      labaBersih,
      status,
      nilaiAset,
    });
  }

  return { records, title: activeTabName, tabExists: true };
}

export async function fetchInvestmentRecords(
  spreadsheetId: string,
  accessToken?: string | null,
  customSheetName?: string
): Promise<{ records: InvestmentRecord[]; title: string; tabExists: boolean }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('Spreadsheet ID tidak valid.');
  }

  const targetTabName = customSheetName?.trim() || SHEET_NAME;

  // 1. If accessToken exists, try official Google Sheets v4 API
  if (accessToken) {
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (metaRes.ok) {
        const metadata = await metaRes.json();
        const sheets: Array<{ properties: { sheetId: number; title: string } }> = metadata.sheets || [];
        const targetSheet = sheets.find(s => s.properties.title.trim().toUpperCase() === targetTabName.toUpperCase()) ||
          sheets.find(s => ['INVESTMENT', 'INVESTASI', 'PORTOFOLIO', 'PORTFOLIO'].includes(s.properties.title.trim().toUpperCase())) ||
          sheets[0];
        const title = targetSheet?.properties?.title || targetTabName;

        const range = `${title}!A2:N100`;
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          const rows: any[][] = data.values || [];

          if (rows.length === 0) {
            return { records: [], title, tabExists: true };
          }

          const records: InvestmentRecord[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[1]) continue;

            const typeRaw = String(row[0] || '').trim().toUpperCase();
            const asset = String(row[1] || '').trim().toUpperCase();
            const nominalIdr = parseIndonesianNumber(row[2], { isCurrency: true });
            const kursIdrUsd = parseIndonesianNumber(row[3], { isKurs: true });
            const jumlah = parseIndonesianNumber(row[4], { isDecimal: true });
            const entryPrice = parseIndonesianNumber(row[7]);

            // Strictly validate real trade (filters out TRANSPORT, empty placeholder rows, budget rows)
            if (!isValidInvestmentTrade(typeRaw, asset, nominalIdr, jumlah, entryPrice)) {
              continue;
            }

            const typeStr: TradeType = (typeRaw === 'SELL' || typeRaw === 'JUAL') ? 'SELL' : 'BUY';
            const entryDate = parseDateToIso(String(row[5] || ''));
            const exitDate = row[6] && !String(row[6]).includes('dd/mm/yyyy') ? parseDateToIso(String(row[6])) : undefined;
            const exitPrice = row[8] ? parseIndonesianNumber(row[8]) : undefined;
            const pnlPercent = parseIndonesianNumber(row[9], { isDecimal: true });
            const spreadCost = parseIndonesianNumber(row[10], { isCurrency: true });
            const labaBersih = parseIndonesianNumber(row[11], { isCurrency: true });
            const rawStatus = String(row[12] || '').trim();
            const status: TradeStatus = rawStatus.toLowerCase().includes('realized') ? 'Realized' : 'Floating';
            const nilaiAset = parseIndonesianNumber(row[13], { isCurrency: true });

            records.push({
              id: `ROW-${i + 2}`,
              rowNumber: i + 2,
              type: typeStr,
              asset,
              nominalIdr,
              kursIdrUsd,
              jumlah,
              entryDate,
              exitDate,
              entryPrice,
              exitPrice,
              pnlPercent,
              spreadCost,
              labaBersih,
              status,
              nilaiAset,
            });
          }

          return { records, title, tabExists: true };
        }
      }
    } catch (err) {
      console.warn('Google v4 API error, falling back to public GViz fetcher:', err);
    }
  }

  // 2. Effortless Zero-Auth Fallback: Fetch via Public Google Visualization API (GViz)
  return await fetchInvestmentRecordsViaGviz(cleanId, targetTabName);
}

export async function appendInvestmentRecord(
  spreadsheetId: string,
  accessToken: string,
  sheetTitle: string,
  record: Omit<InvestmentRecord, 'rowNumber' | 'id'>
): Promise<void> {
  const rowValues = [
    record.type,
    record.asset,
    record.nominalIdr,
    record.kursIdrUsd || '',
    record.jumlah,
    record.entryDate,
    record.exitDate || '',
    record.entryPrice,
    record.exitPrice || '',
    `${record.pnlPercent.toFixed(2)}%`,
    record.spreadCost,
    record.labaBersih,
    record.status,
    record.nilaiAset,
  ];

  const range = `${sheetTitle}!A:N`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to append record to Google Sheets: ${await res.text()}`);
  }
}

export async function updateInvestmentRecord(
  spreadsheetId: string,
  accessToken: string,
  sheetTitle: string,
  rowNumber: number,
  record: InvestmentRecord
): Promise<void> {
  const rowValues = [
    record.type,
    record.asset,
    record.nominalIdr,
    record.kursIdrUsd || '',
    record.jumlah,
    record.entryDate,
    record.exitDate || '',
    record.entryPrice,
    record.exitPrice || '',
    `${record.pnlPercent.toFixed(2)}%`,
    record.spreadCost,
    record.labaBersih,
    record.status,
    record.nilaiAset,
  ];

  const range = `${sheetTitle}!A${rowNumber}:N${rowNumber}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to update row ${rowNumber} in Google Sheets: ${await res.text()}`);
  }
}

export async function deleteInvestmentRecordRow(
  spreadsheetId: string,
  accessToken: string,
  sheetId: number,
  rowNumber: number
): Promise<void> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to delete row ${rowNumber} from Google Sheets: ${await res.text()}`);
  }
}

// EXACT 10 RECORDS FROM USER'S SPREADSHEET (Image 2)
export const INITIAL_SAMPLE_RECORDS: InvestmentRecord[] = [
  {
    id: 'ROW-2',
    rowNumber: 2,
    type: 'BUY',
    asset: 'GOLD',
    nominalIdr: 10000000,
    kursIdrUsd: 0,
    jumlah: 3.8,
    entryDate: '2026-01-05',
    exitDate: '2026-01-29',
    entryPrice: 2630000.0,
    exitPrice: 3110000.0,
    pnlPercent: 18.25,
    spreadCost: -109060,
    labaBersih: 1714940,
    status: 'Realized',
    nilaiAset: 0,
  },
  {
    id: 'ROW-3',
    rowNumber: 3,
    type: 'BUY',
    asset: 'MSFT',
    nominalIdr: 14800000,
    kursIdrUsd: 17716,
    jumlah: 1.94,
    entryDate: '2026-05-19',
    exitDate: '2026-06-11',
    entryPrice: 426.0,
    exitPrice: 389.6,
    pnlPercent: -8.54,
    spreadCost: -140157,
    labaBersih: -1404758,
    status: 'Realized',
    nilaiAset: 0,
  },
  {
    id: 'ROW-4',
    rowNumber: 4,
    type: 'BUY',
    asset: 'SPCX',
    nominalIdr: 6110000,
    kursIdrUsd: 17860,
    jumlah: 2.0,
    entryDate: '2026-06-12',
    exitDate: '2026-06-17',
    entryPrice: 172.0,
    exitPrice: 209.0,
    pnlPercent: 21.51,
    spreadCost: -68047,
    labaBersih: 1246314,
    status: 'Realized',
    nilaiAset: 0,
  },
  {
    id: 'ROW-5',
    rowNumber: 5,
    type: 'BUY',
    asset: 'WDC',
    nominalIdr: 6260000,
    kursIdrUsd: 17890,
    jumlah: 0.635,
    entryDate: '2026-07-22',
    exitDate: '2026-06-27',
    entryPrice: 550.0,
    exitPrice: 493.0,
    pnlPercent: -10.36,
    spreadCost: -59243,
    labaBersih: -708007,
    status: 'Realized',
    nilaiAset: 0,
  },
  {
    id: 'ROW-6',
    rowNumber: 6,
    type: 'BUY',
    asset: 'NVDA',
    nominalIdr: 4850000,
    kursIdrUsd: 17890,
    jumlah: 1.3,
    entryDate: '2026-07-22',
    exitDate: undefined,
    entryPrice: 207.7,
    exitPrice: 227.2,
    pnlPercent: 9.39,
    spreadCost: -24152,
    labaBersih: 431425,
    status: 'Floating',
    nilaiAset: 5277725,
  },
  {
    id: 'ROW-7',
    rowNumber: 7,
    type: 'BUY',
    asset: 'QCOM',
    nominalIdr: 3635000,
    kursIdrUsd: 17890,
    jumlah: 1.15,
    entryDate: '2026-07-22',
    exitDate: '2026-07-30',
    entryPrice: 176.0,
    exitPrice: 157.0,
    pnlPercent: -10.8,
    spreadCost: -34255,
    labaBersih: -426670,
    status: 'Realized',
    nilaiAset: 0,
  },
  {
    id: 'ROW-8',
    rowNumber: 8,
    type: 'BUY',
    asset: 'SPCX',
    nominalIdr: 3147000,
    kursIdrUsd: 18140,
    jumlah: 1.5,
    entryDate: '2026-07-28',
    exitDate: undefined,
    entryPrice: 116.0,
    exitPrice: 149.2,
    pnlPercent: 28.66,
    spreadCost: -15782,
    labaBersih: 885996,
    status: 'Floating',
    nilaiAset: 3999930,
  },
  {
    id: 'ROW-9',
    rowNumber: 9,
    type: 'BUY',
    asset: 'QQQ',
    nominalIdr: 5710000,
    kursIdrUsd: 18033,
    jumlah: 0.465,
    entryDate: '2026-07-30',
    exitDate: undefined,
    entryPrice: 681.0,
    exitPrice: 737.9,
    pnlPercent: 8.36,
    spreadCost: -28552,
    labaBersih: 448790,
    status: 'Floating',
    nilaiAset: 6131180,
  },
  {
    id: 'ROW-10',
    rowNumber: 10,
    type: 'BUY',
    asset: 'SPCX',
    nominalIdr: 2012000,
    kursIdrUsd: 17767,
    jumlah: 0.8,
    entryDate: '2026-08-27',
    exitDate: undefined,
    entryPrice: 141.0,
    exitPrice: 149.2,
    pnlPercent: 5.84,
    spreadCost: -10021,
    labaBersih: 107560,
    status: 'Floating',
    nilaiAset: 2133296,
  },
  {
    id: 'ROW-11',
    rowNumber: 11,
    type: 'BUY',
    asset: 'MSTR',
    nominalIdr: 2000000,
    kursIdrUsd: 17980,
    jumlah: 0.7,
    entryDate: '2026-09-28',
    exitDate: undefined,
    entryPrice: 158.5,
    exitPrice: 154.7,
    pnlPercent: -2.42,
    spreadCost: -9974,
    labaBersih: -58302,
    status: 'Floating',
    nilaiAset: 1946677,
  },
];
