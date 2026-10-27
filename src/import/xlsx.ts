// SheetJS glue (pure JS; works in Node tests and in the app).
import * as XLSX from 'xlsx';
import type { Cell, Sheets } from './sampleWorkbook';

/** Every sheet as rows of raw cell values (dates as Date when the cell is a date). */
export function workbookToSheets(wb: XLSX.WorkBook): Sheets {
  return Object.fromEntries(
    wb.SheetNames.map((name) => [name, XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })]),
  );
}

export const readBase64Workbook = (base64: string): Sheets => workbookToSheets(XLSX.read(base64, { type: 'base64', cellDates: true }));

/** Builds a workbook from rows (used to generate the example file). */
export function sheetsToWorkbook(sheets: Sheets): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (rows[0] ?? []).map((_, i) => ({ wch: Math.max(12, ...rows.map((r) => String(r[i] ?? '').length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}
