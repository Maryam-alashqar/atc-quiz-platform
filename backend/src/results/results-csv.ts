interface CsvResult {
  id: string;
  student: { username: string; name: string; class: { name: string } | null };
  status: string;
  score: { toString(): string } | null;
  maxScore: { toString(): string };
  percentage: string | null;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
}

function cell(value: string): string {
  // Neutralize spreadsheet formulas, including leading whitespace/control characters.
  const safe =
    // eslint-disable-next-line no-control-regex -- control prefixes must not bypass formula protection
    /^[\s\u0000-\u001f]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function resultsCsv(rows: CsvResult[]): string {
  const header = [
    'attempt_id',
    'username',
    'student_name',
    'class',
    'status',
    'score',
    'max_score',
    'percentage',
    'started_at',
    'deadline_at',
    'submitted_at',
  ];
  const records = rows.map((row) => [
    row.id,
    row.student.username,
    row.student.name,
    row.student.class?.name ?? '',
    row.status,
    row.score?.toString() ?? '',
    row.maxScore.toString(),
    row.percentage ?? '',
    row.startedAt.toISOString(),
    row.deadlineAt.toISOString(),
    row.submittedAt?.toISOString() ?? '',
  ]);
  return (
    '\uFEFF' +
    [header, ...records]
      .map((record) => record.map(cell).join(','))
      .join('\r\n') +
    '\r\n'
  );
}
