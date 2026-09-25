import ExcelJS from 'exceljs';
import {
  datasetFromWorkbook,
  ImportFileError,
  readWorkbook,
} from './spreadsheet.js';

type Cell = ExcelJS.CellValue;

async function workbook(sheets: Record<string, Cell[][]>): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets))
    book.addWorksheet(name).addRows(rows);
  return Buffer.from(await book.xlsx.writeBuffer());
}

const valid = (): Record<string, Cell[][]> => ({
  Classes: [['name'], ['12A']],
  Users: [
    ['username', 'name', 'role', 'className', 'password'],
    ['teacher-ar', 'هدى صالح', 'TEACHER', '', 'Welcome2026!'],
    ['S12A-01', 'ليان أحمد', 'STUDENT', '12A', 'Welcome2026!'],
  ],
  quizzes: [
    [
      'id',
      'teacherUsername',
      'title',
      'description',
      'language',
      'durationMinutes',
      'opensAt',
      'closesAt',
      'status',
      'negativeMarking',
      'penaltyValue',
      'classNames',
    ],
    [
      'a7c00000-0000-4000-8000-0000000000aa',
      'teacher-ar',
      'قواعد',
      '',
      'AR',
      20, // typed as a number in Excel
      new Date(Date.UTC(2030, 0, 5, 9, 0)), // an Excel date: Amman wall-clock 09:00
      '2030-01-12T09:00:00+03:00',
      'PUBLISHED',
      'FRACTION',
      0.25,
      '12A',
    ],
  ],
  questions: [
    [
      'quizId',
      'order',
      'prompt',
      'points',
      'option1',
      'option2',
      'option3',
      'option4',
      'correctOption',
    ],
    [
      'a7c00000-0000-4000-8000-0000000000aa',
      1,
      {
        richText: [
          { text: 'ما ' },
          { text: 'جمع كتاب؟', font: { bold: true } },
        ],
      },
      { formula: '1+0.5', result: 1.5 },
      'كتب',
      'كتاب',
      'كاتب',
      'مكتبة',
      1,
    ],
  ],
});

describe('Spreadsheet import — reading an Excel workbook', () => {
  it('reads the four sheets whatever their capitalisation', async () => {
    const tables = await readWorkbook(await workbook(valid()));
    expect(Object.keys(tables).sort()).toEqual([
      'classes',
      'questions',
      'quizzes',
      'users',
    ]);
  });

  it('turns typed cells into the text the validator expects', async () => {
    const data = await datasetFromWorkbook(await workbook(valid()));
    expect(data.quizzes[0]).toMatchObject({
      durationMinutes: 20,
      penaltyValue: '0.25',
      // The Excel date is Amman time, so 09:00 there is 06:00 UTC.
      opensAt: new Date('2030-01-05T06:00:00Z'),
    });
    expect(data.questions[0]).toMatchObject({
      prompt: 'ما جمع كتاب؟',
      points: '1.5',
    });
    expect(data.users.map((u) => u.username)).toEqual([
      'teacher-ar',
      's12a-01',
    ]);
  });

  it('skips empty rows at the end of a sheet', async () => {
    const sheets = valid();
    sheets.Classes.push([], ['', '']);
    const data = await datasetFromWorkbook(await workbook(sheets));
    expect(data.classes).toHaveLength(1);
  });

  it('names the sheet and row of an invalid value', async () => {
    const sheets = valid();
    sheets.Users[2][2] = 'PRINCIPAL';
    await expect(datasetFromWorkbook(await workbook(sheets))).rejects.toThrow(
      /^Sheet "users", row 3: role must be one of STUDENT, TEACHER, ADMIN\.$/,
    );
  });

  it('lists the sheets a workbook is missing', async () => {
    const sheets = valid();
    delete sheets.questions;
    await expect(readWorkbook(await workbook(sheets))).rejects.toThrow(
      'Missing: questions.',
    );
  });

  it('rejects a file that is not an Excel workbook', async () => {
    await expect(
      readWorkbook(Buffer.from('name\n10A\n')),
    ).rejects.toBeInstanceOf(ImportFileError);
  });
});
