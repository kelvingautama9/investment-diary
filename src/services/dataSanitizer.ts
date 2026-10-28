import type { InvestmentRecord, DataAnomaly } from '../types';
import { isNonInvestmentOrExpense } from './googleSheets';

export interface SanitizationReport {
  anomalies: DataAnomaly[];
  totalRecordsChecked: number;
  cleanRecordsCount: number;
  errorCount: number;
  warningCount: number;
}

export function detectDataAnomalies(records: InvestmentRecord[]): SanitizationReport {
  const anomalies: DataAnomaly[] = [];

  const validRecords = records.filter(
    r => !isNonInvestmentOrExpense(r.asset) && !isNonInvestmentOrExpense(r.type)
  );

  validRecords.forEach(rec => {
    // 1. Invalid Dates (Exit Date before Entry Date)
    if (rec.entryDate && rec.exitDate) {
      const entryTime = new Date(rec.entryDate).getTime();
      const exitTime = new Date(rec.exitDate).getTime();
      if (!isNaN(entryTime) && !isNaN(exitTime) && exitTime < entryTime) {
        anomalies.push({
          recordId: rec.id,
          rowNumber: rec.rowNumber,
          asset: rec.asset,
          issueType: 'INVALID_DATES',
          severity: 'error',
          title: 'Tanggal Exit Mendahului Entry',
          description: `Tanggal keluar (${rec.exitDate}) terjadi sebelum tanggal masuk (${rec.entryDate}).`,
          suggestedFix: 'Perbaiki tanggal beli atau tanggal jual agar kronologis.',
        });
      }
    }

    // 2. Missing Exit Price on Closed/Realized Position
    if (rec.status === 'Realized' && (!rec.exitPrice || rec.exitPrice <= 0)) {
      anomalies.push({
        recordId: rec.id,
        rowNumber: rec.rowNumber,
        asset: rec.asset,
        issueType: 'MISSING_EXIT_PRICE',
        severity: 'error',
        title: 'Status Realized Tanpa Exit Price',
        description: `Posisi ${rec.asset} ditandai Realized, namun Exit Price kosong atau 0.`,
        suggestedFix: 'Isi harga penutupan posisi (Exit Price) atau kembalikan status ke Floating.',
      });
    }

    // 3. Unrealized with Exit Data
    if (rec.status === 'Floating' && ((rec.exitPrice && rec.exitPrice > 0) || (rec.exitDate && rec.exitDate.trim().length > 0))) {
      anomalies.push({
        recordId: rec.id,
        rowNumber: rec.rowNumber,
        asset: rec.asset,
        issueType: 'UNREALIZED_WITH_EXIT',
        severity: 'warning',
        title: 'Posisi Floating Memiliki Data Exit',
        description: `Posisi ${rec.asset} bertanda Floating tetapi sudah terisi Exit Price ($${rec.exitPrice}) atau Exit Date (${rec.exitDate}).`,
        suggestedFix: 'Ubah status menjadi Realized jika posisi sudah ditutup.',
      });
    }

    // 4. Extreme or Typo PnL % (> 500% or < -95%)
    if (rec.pnlPercent > 500 || rec.pnlPercent < -95) {
      anomalies.push({
        recordId: rec.id,
        rowNumber: rec.rowNumber,
        asset: rec.asset,
        issueType: 'EXTREME_PNL',
        severity: 'warning',
        title: `Persentase PnL Ekstrem (${rec.pnlPercent.toFixed(1)}%)`,
        description: `Angka ROI ${rec.pnlPercent > 0 ? '+' : ''}${rec.pnlPercent.toFixed(1)}% tidak lazim. Sering terjadi akibat typo desimal/koma pada harga entry atau exit.`,
        suggestedFix: 'Periksa kembali Entry Price vs Exit Price dan Kurs IDR/USD.',
      });
    }

    // 5. Zero or Negative Nominal Capital
    if (rec.nominalIdr <= 0) {
      anomalies.push({
        recordId: rec.id,
        rowNumber: rec.rowNumber,
        asset: rec.asset,
        issueType: 'ZERO_NOMINAL',
        severity: 'error',
        title: 'Nominal Modal Kosong / Nol',
        description: `Posisi ${rec.asset} memiliki nominal modal Rp ${rec.nominalIdr || 0}.`,
        suggestedFix: 'Isi nominal rupiah modal yang dialokasikan ke posisi ini.',
      });
    }

    // 6. Zero or Negative Quantity
    if (rec.jumlah <= 0) {
      anomalies.push({
        recordId: rec.id,
        rowNumber: rec.rowNumber,
        asset: rec.asset,
        issueType: 'ZERO_QTY',
        severity: 'warning',
        title: 'Kuantitas Lot/Unit Kosong',
        description: `Jumlah unit/lembar aset tercatat ${rec.jumlah}.`,
        suggestedFix: 'Isi jumlah lembar atau lot saham/aset yang dibeli.',
      });
    }
  });

  const errorCount = anomalies.filter(a => a.severity === 'error').length;
  const warningCount = anomalies.filter(a => a.severity === 'warning').length;

  return {
    anomalies,
    totalRecordsChecked: validRecords.length,
    cleanRecordsCount: validRecords.length - anomalies.length,
    errorCount,
    warningCount,
  };
}
