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
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
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

// Zero-Auth Public Google Sheet Fetcher via GViz API (Requires ZERO login, ZERO Firebase, ZERO setup)
export async function fetchInvestmentRecordsViaGviz(
  spreadsheetId: string,
  sheetName: string = SHEET_NAME
): Promise<{ records: InvestmentRecord[]; title: string; tabExists: boolean }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('ID Spreadsheet tidak valid.');
  }

  const urls = [
    `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`,
    `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json`,
  ];

  let rawJson: any = null;
  let lastError = '';

  for (const url of urls) {
    try {
      const res = await fetch(url);
      const text = await res.text();

      // Check if Google returned restricted / 404 access
      if (
        text.includes('Page not found') ||
        text.includes('google.com/start/apps') ||
        text.includes('Sorry, the file you have requested does not exist') ||
        res.status === 404
      ) {
        throw new Error('RESTRICTED_ACCESS');
      }

      // Extract JSON from Google's setResponse wrapper
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed?.status === 'error') {
          lastError = parsed.errors?.[0]?.message || 'Query error';
          continue;
        }
        if (parsed?.table) {
          rawJson = parsed;
          break;
        }
      }
    } catch (e: any) {
      if (e?.message === 'RESTRICTED_ACCESS') throw e;
      lastError = e?.message || 'Network error';
    }
  }

  if (!rawJson?.table) {
    if (lastError.includes('RESTRICTED') || lastError.includes('404')) {
      throw new Error('RESTRICTED_ACCESS');
    }
    throw new Error(`Tidak dapat membaca Google Sheet: ${lastError || 'Pastikan akses diubah ke Siapa saja yang memiliki link'}`);
  }

  const table = rawJson.table;
  const rows = table.rows || [];

  // Determine if row 0 has headers (e.g. Type, Asset)
  let startIndex = 0;
  if (rows.length > 0) {
    const c0 = rows[0]?.c?.[0]?.v || '';
    const c1 = rows[0]?.c?.[1]?.v || '';
    const combined = `${c0} ${c1}`.toUpperCase();
    if (combined.includes('TYPE') || combined.includes('ASSET')) {
      startIndex = 1;
    }
  }

  const records: InvestmentRecord[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const c = rows[i]?.c || [];
    const getVal = (idx: number) => {
      const cell = c[idx];
      if (!cell) return '';
      return cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : '');
    };

    const typeRaw = String(getVal(0) || 'BUY').trim().toUpperCase();
    const typeStr: TradeType = typeRaw === 'SELL' ? 'SELL' : 'BUY';
    const asset = String(getVal(1) || '').trim().toUpperCase();
    if (!asset || asset === 'ASSET') continue;

    const nominalIdr = parseIndonesianNumber(getVal(2), { isCurrency: true });
    const kursIdrUsd = parseIndonesianNumber(getVal(3), { isKurs: true });
    const jumlah = parseIndonesianNumber(getVal(4), { isDecimal: true });
    const entryDate = parseDateToIso(String(getVal(5) || ''));
    const exitDateRaw = String(getVal(6) || '');
    const exitDate = exitDateRaw && !exitDateRaw.includes('dd/mm/yyyy') ? parseDateToIso(exitDateRaw) : undefined;
    const entryPrice = parseIndonesianNumber(getVal(7));
    const exitPriceRaw = getVal(8);
    const exitPrice = exitPriceRaw ? parseIndonesianNumber(exitPriceRaw) : undefined;
    const pnlPercent = parseIndonesianNumber(getVal(9), { isDecimal: true });
    const spreadCost = parseIndonesianNumber(getVal(10), { isCurrency: true });
    const labaBersih = parseIndonesianNumber(getVal(11), { isCurrency: true });
    const rawStatus = String(getVal(12) || '').trim();
    const status: TradeStatus = rawStatus.toLowerCase().includes('realized') ? 'Realized' : 'Floating';
    const nilaiAset = parseIndonesianNumber(getVal(13), { isCurrency: true });

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

  return { records, title: sheetName, tabExists: true };
}

export async function fetchInvestmentRecords(
  spreadsheetId: string,
  accessToken?: string | null
): Promise<{ records: InvestmentRecord[]; title: string; tabExists: boolean }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('Spreadsheet ID tidak valid.');
  }

  // 1. If accessToken exists, try official Google Sheets v4 API
  if (accessToken) {
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (metaRes.ok) {
        const metadata = await metaRes.json();
        const sheets: Array<{ properties: { sheetId: number; title: string } }> = metadata.sheets || [];
        const targetSheet = sheets.find(s => s.properties.title.trim().toUpperCase() === SHEET_NAME) || sheets[0];
        const title = targetSheet?.properties?.title || SHEET_NAME;

        const range = `${title}!A2:N50`;
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
            if (!row || row.length === 0 || !row[1] || row[1].trim() === '') continue;

            const typeStr = (String(row[0] || 'BUY').trim().toUpperCase() as TradeType) || 'BUY';
            const asset = String(row[1] || '').trim().toUpperCase();
            const nominalIdr = parseIndonesianNumber(row[2], { isCurrency: true });
            const kursIdrUsd = parseIndonesianNumber(row[3], { isKurs: true });
            const jumlah = parseIndonesianNumber(row[4], { isDecimal: true });
            const entryDate = parseDateToIso(String(row[5] || ''));
            const exitDate = row[6] && !String(row[6]).includes('dd/mm/yyyy') ? parseDateToIso(String(row[6])) : undefined;
            const entryPrice = parseIndonesianNumber(row[7]);
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
  return await fetchInvestmentRecordsViaGviz(cleanId);
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
