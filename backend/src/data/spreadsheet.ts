import ExcelJS from 'exceljs';
import { parseDataset, SHEETS, type Dataset, type SheetKind } from './csv.js';

/** Error with a message that is safe to show to the admin (no cell values, no credentials). */
export class ImportFileError extends Error {}

const MAX_ROWS = 5_000;

/**
 * Excel stores typed cells; the validator expects the text a teacher typed.
 * - numbers as written (20, 1.5)
 * - dates as Amman wall-clock time with an explicit offset (Excel dates carry no timezone;
 *   Jordan has used UTC+3 all year since 2022)
 * - formulas as their computed result, rich text and links as their text
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return value.toISOString().replace(/\.\d{3}Z$/, '+03:00');
  if (typeof value === 'object') {
    if ('richText' in value)
      return value.richText.map((part) => part.text).join('');
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text);
    if ('error' in value) return '';
    return '';
  }
  return String(value);
}

/**
 * Read the four tables from one workbook. Sheets are matched by name, ignoring case and
 * spaces ("Users", "users "), so a teacher-made file does not need to be exact.
 */
export async function readWorkbook(
  buffer: Buffer,
): Promise<Record<SheetKind, string[][]>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportFileError(
      'The file could not be read as an Excel workbook (.xlsx).',
    );
  }
  const byName = new Map(
    workbook.worksheets.map((sheet) => [
      sheet.name.trim().toLowerCase(),
      sheet,
    ]),
  );
  const missing = SHEETS.filter((name) => !byName.has(name));
  if (missing.length)
    throw new ImportFileError(
      `The workbook needs these sheets: ${SHEETS.join(', ')}. Missing: ${missing.join(', ')}.`,
    );

  const tables = {} as Record<SheetKind, string[][]>;
  for (const name of SHEETS) {
    const sheet = byName.get(name)!;
    if (sheet.rowCount > MAX_ROWS)
      throw new ImportFileError(
        `Sheet "${name}" has more than ${MAX_ROWS} rows.`,
      );
    // Width comes from the header row; trailing empty cells are padded, empty rows skipped.
    const header = sheet.getRow(1);
    const width = header.cellCount;
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = Array.from({ length: width }, (_, i) =>
        cellText(row.getCell(i + 1).value),
      );
      if (cells.some((cell) => cell.trim() !== '')) rows.push(cells);
    });
    tables[name] = rows;
  }
  return tables;
}

/** Validator messages name "users.csv record 3"; for a workbook, say sheet and row instead. */
export function forWorkbook(message: string): string {
  return message
    .replace(
      /\b(classes|users|quizzes|questions)\.csv record (\d+)/g,
      'Sheet "$1", row $2',
    )
    .replace(/\b(classes|users|quizzes|questions)\.csv\b/g, 'Sheet "$1"');
}

export async function datasetFromWorkbook(buffer: Buffer): Promise<Dataset> {
  const tables = await readWorkbook(buffer);
  try {
    return parseDataset(tables);
  } catch (error) {
    throw new ImportFileError(
      forWorkbook(error instanceof Error ? error.message : 'Invalid data.'),
    );
  }
}
