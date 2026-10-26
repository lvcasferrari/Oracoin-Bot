// Writes the example spreadsheet (dummy data) from the import template: npm run sample:xlsx
import { mkdirSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { SAMPLE_SHEETS } from '../src/import/sampleWorkbook';
import { sheetsToWorkbook } from '../src/import/xlsx';

const dir = 'assets/examples';
const out = `${dir}/life-strategic-plan-exemplo.xlsx`;
mkdirSync(dir, { recursive: true });
writeFileSync(out, XLSX.write(sheetsToWorkbook(SAMPLE_SHEETS), { type: 'buffer', bookType: 'xlsx', compression: true }));
console.log(`wrote ${out}`);
