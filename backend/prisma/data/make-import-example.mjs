// Builds frontend/public/atc-import-example.xlsx: the workbook the admin can download from
// the Import page. It adds a new class (12A) with its students, a teacher and one quiz,
// so importing it into the seeded demo shows real additions.
// Run from backend/: node prisma/data/make-import-example.mjs
import ExcelJS from 'exceljs';

const QUIZ = 'a7c00000-0000-4000-8000-0000000012a1';
const PASSWORD = 'Welcome2026!';

const sheets = {
  classes: [['name'], ['12A']],
  users: [
    ['username', 'name', 'role', 'className', 'password'],
    ['teacher-chemistry', 'سلمى داوود', 'TEACHER', '', PASSWORD],
    ...[
      'ريم القاسم',
      'يزن العمري',
      'جود الصرايرة',
      'مالك الزعبي',
      'سلمى الحياري',
      'عمر البطاينة',
    ].map((name, i) => [`s12a-0${i + 1}`, name, 'STUDENT', '12A', PASSWORD]),
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
      QUIZ,
      'teacher-chemistry',
      'مراجعة الكيمياء: الوحدة الأولى',
      'اختبار قصير. كل إجابة خاطئة تخصم ربع علامة السؤال.',
      'AR',
      20,
      '2026-09-20T09:00:00+03:00',
      '2027-06-30T18:00:00+03:00',
      'PUBLISHED',
      'FRACTION',
      0.25,
      '12A',
    ],
  ],
  questions: [
    ['quizId', 'order', 'prompt', 'points', 'option1', 'option2', 'option3', 'option4', 'correctOption'],
    [QUIZ, 1, 'ما الرمز الكيميائي للصوديوم؟', 1, 'S', 'Na', 'So', 'N', 2],
    [QUIZ, 2, 'كم عدد البروتونات في ذرة الكربون؟', 1.5, '4', '6', '8', '12', 2],
    [QUIZ, 3, 'أيّ مما يلي مركّب وليس عنصراً؟', 1, 'الأكسجين', 'الحديد', 'الماء', 'الذهب', 3],
    [QUIZ, 4, 'ما الرقم الهيدروجيني (pH) لمحلول متعادل؟', 2, '0', '7', '10', '14', 2],
    [QUIZ, 5, 'أيّ غاز ينتج عن تفاعل حمض مع فلز نشط؟', 1.5, 'الأكسجين', 'النيتروجين', 'الهيدروجين', 'ثاني أكسيد الكربون', 3],
  ],
};

const readMe = [
  ['ATC — Amman Tutoring Center: import template'],
  [''],
  ['Keep the four sheets below with these exact names and header rows. Add one row per record.'],
  ['classes', 'name — for example 10A'],
  ['users', 'username (a-z, 0-9, . _ -), name, role (STUDENT / TEACHER / ADMIN), className (students only), password (8+ characters, a first password to hand over)'],
  ['quizzes', 'id (a UUID, keep it the same on every export), teacherUsername, title, description, language (AR / EN), durationMinutes, opensAt and closesAt (e.g. 2026-09-28T09:00:00+03:00 or an Excel date in Amman time), status (DRAFT / PUBLISHED), negativeMarking (NONE / FRACTION / FIXED), penaltyValue, classNames (separate with |)'],
  ['questions', 'quizId, order (1, 2, 3 …), prompt, points, option1–option4, correctOption (1–4)'],
  [''],
  ['Every class, teacher and quiz a row refers to must be listed in this file, even if it already exists. Existing records are never overwritten.'],
];

const book = new ExcelJS.Workbook();
book.creator = 'ATC';
const intro = book.addWorksheet('Read me');
intro.addRows(readMe);
intro.getRow(1).font = { bold: true, size: 14 };
intro.getColumn(1).width = 14;
intro.getColumn(2).width = 120;

for (const [name, rows] of Object.entries(sheets)) {
  const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = Math.min(
      45,
      Math.max(12, ...rows.map((row) => String(row[column.number - 1] ?? '').length + 2)),
    );
  });
}

const target = new URL('../../../frontend/public/atc-import-example.xlsx', import.meta.url);
await book.xlsx.writeFile(target);
console.log('Wrote', target.pathname);
