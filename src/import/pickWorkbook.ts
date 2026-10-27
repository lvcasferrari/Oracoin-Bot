// The only import file that touches native modules. The file is read on the device and never uploaded.
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { checkFile } from './mapWorkbook';
import type { Sheets } from './sampleWorkbook';
import { readBase64Workbook } from './xlsx';

/** A problem worth showing to the user as is (already calm pt-BR). */
export class ImportFileError extends Error {}

export async function pickWorkbook(): Promise<{ name: string; sheets: Sheets } | null> {
  // "*/*": Android often reports .xlsx with a generic type; the extension is checked instead.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const problem = checkFile({ name: asset.name, size: asset.size });
  if (problem) throw new ImportFileError(problem);
  const base64 = await new File(asset.uri).base64();
  if (base64.length * 0.75 > 5 * 1024 * 1024) throw new ImportFileError('O arquivo passa de 5 MB. Use uma planilha menor.');
  try {
    return { name: asset.name, sheets: readBase64Workbook(base64) };
  } catch {
    throw new ImportFileError('Não consegui ler esta planilha. Confira se é um arquivo .xlsx.');
  }
}
