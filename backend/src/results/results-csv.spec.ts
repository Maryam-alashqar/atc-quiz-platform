import { parse } from 'csv-parse/sync';
import { resultsCsv } from './results-csv.js';

describe('Result CSV - spreadsheet-safe text', () => {
  it.each([
    '=SUM(1,2)',
    '+123',
    '-123',
    '@SUM(A1)',
    '  =1',
    '\ttext',
    '\rtext',
    '\ntext',
  ])('neutralizes a spreadsheet-sensitive name %j', (name) => {
    const csv = resultsCsv([
      {
        id: 'attempt',
        student: { username: 'student', name, class: null },
        status: 'SUBMITTED',
        score: '0',
        maxScore: '7',
        percentage: '0.00',
        startedAt: new Date(0),
        deadlineAt: new Date(60_000),
        submittedAt: new Date(30_000),
      },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const rows = parse(csv, { bom: true, columns: true }) as Record<
      string,
      string
    >[];
    expect(rows[0].student_name).toBe(`'${name}`);
    expect(rows[0].score).toBe('0');
    expect(rows[0].class).toBe('');
  });
});
