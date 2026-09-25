# CSV import and demo data

From the repository root start PostgreSQL with `docker compose up -d postgres`.
Then, from `backend`, configure `.env` using `.env.example` and run:

```sh
npm ci
npm run db:deploy
npm run db:seed
```

On Windows PowerShell use `npm.cmd` if `npm.ps1` is blocked. The seed command
generates the Prisma client, compiles TypeScript, then calls the same CSV parser,
validator and transactional importer used for external data. Prisma's
`prisma db seed --config prisma7.config.ts` also invokes this command.

## Demo accounts

All supplied accounts use the **local demo password `AtcDemo2026!`**. These are
fictional accounts, not production credentials. Passwords in the database are
salted scrypt hashes. The login API is available; see
[authentication.md](../../docs/authentication.md) for startup and manual login steps.

| Role | Username | Details |
| --- | --- | --- |
| Student | `s10a-01` | أحمد الخطيب, class 10A |
| Student | `s10b-01` | Class 10B |
| Student | `s11a-01` | Class 11A |
| Teacher | `teacher-math` | رنا الخطيب |
| Teacher | `teacher-english` | سامي النجار |
| Teacher | `teacher-physics` | هبة العبادي |
| Teacher | `teacher-science` | مازن التميمي |
| Admin | `admin` | نور الحسن |

Each class has usernames numbered `01` through `20`: 60 students, four teachers,
one admin, three classes, five quizzes, 75 questions and 300 options in total.
Questions have variable point values of 1, 1.5 and 2 (22.5 total per quiz).

| Quiz | Language | State on first seed | Marking | Classes |
| --- | --- | --- | --- | --- |
| مراجعة الجبر والهندسة | AR | Published/open | None | 10A, 10B |
| English Grammar: Weekly Review | EN | Published/open | Fraction 0.25 | All three |
| القوى والطاقة والكهرباء | AR | Published/upcoming | Fixed 0.5 | 11A |
| مراجعة الأسبوع الماضي: رياضيات | AR | Published/closed | Fraction 0.25 | 10A, 10B |
| Physics Fundamentals — Draft | EN | Draft | None | 11A |

The demo's `NOW-1D`/`NOW+30D` etc. placeholders are resolved once against a common
timestamp during **seed**. Open quizzes remain open for 30 days after first
creation. Repeat seeds preserve existing dates, content, passwords and attempts;
they do not reopen expired quizzes or reset progress. No attempts are seeded.

## Importing a spreadsheet export

The admin can also do this in the browser: *Import* in the admin menu checks a workbook or the four CSV files, shows what would change, then imports ([admin API](../../docs/admin.md)). The command below does the same from a terminal.

Export four files as UTF-8 CSV into a directory and run from `backend`:

```sh
npm run db:import -- "C:/path/to/csv-folder"
```

Each import is a self-contained batch: referenced classes, teachers and quizzes
must be listed in the same directory even if they already exist in the database.
All four files require a header and at least one data record. Exact header names
are case-sensitive; column order may vary. No extra/missing columns are accepted.

| File | Columns |
| --- | --- |
| `classes.csv` | `name` |
| `users.csv` | `username,name,role,className,password` |
| `quizzes.csv` | `id,teacherUsername,title,description,language,durationMinutes,opensAt,closesAt,status,negativeMarking,penaltyValue,classNames` |
| `questions.csv` | `quizId,order,prompt,points,option1,option2,option3,option4,correctOption` |

- Usernames are normalized to lowercase ASCII; Arabic display names and quiz
  text are preserved. STUDENT requires className; TEACHER/ADMIN leave it empty.
- Passwords are 8–128 characters and are not trimmed. Existing passwords are not
  reset. Real import files contain initial credentials; keep them out of Git and
  remove them from shared locations after use.
- Quiz IDs are stable UUIDs chosen in the source data. Keep them unchanged on
  repeat exports. teacherUsername must identify a TEACHER; languages are AR/EN;
  states are DRAFT/PUBLISHED. Separate classNames using `|`, e.g. `10A|10B`.
- Normal imports require ISO timestamps with a timezone, for example
  `2026-09-24T09:00:00+03:00`. `NOW...` is accepted only by `db:seed`; when using
  the samples as external-import templates, replace those dates with ISO values.
- Duration and question order are positive integers. A quiz needs at least one
  question (15 is a sample size, not an application limit). Question orders must
  be unique within a quiz. Four distinct, nonempty options and correctOption 1–4
  are required, including for imported drafts.
- Points must be positive decimals with up to four fractional digits. NONE needs
  penaltyValue 0; FRACTION needs a value greater than 0 and at most 1; FIXED needs
  a positive value. Numeric values use a dot decimal separator.
- UTF-8 BOM, CRLF/LF, quoted commas, doubled quotes and multiline cells work.
  Semicolon-delimited exports and XLSX files are not accepted. Each file is limited
  to 5 MB. Error locations use CSV record numbers (including the header), not
  physical line numbers, because a quoted cell may contain newlines.

## Repeat imports and failures

Import is **append-only**, not an edit/sync operation. Identity is class name,
normalized username, and quiz UUID. Existing records are counted as skipped;
an existing quiz's questions/options/assignments are skipped as a whole. Missing
records are inserted; missing rows in later CSVs never delete existing data.

An existing username with another role/class, or quiz UUID with another teacher,
rejects the entire batch. Other existing user/quiz fields remain unchanged even
if different values appear in the CSV. Use the future management API for edits.

All files are validated before any writes. Database writes use one transaction;
an error rolls back the entire batch. A transaction-level PostgreSQL advisory
lock serializes importer processes, so concurrent runs do not create duplicates.
The CLI prints created/skipped counts, never passwords, and returns a nonzero exit
status on failure. There is no destructive reset or overwrite flag.

## Verification

```sh
npm run typecheck
npm test
npm run test:db
npm run test:e2e
npm run lint
```

Database integration tests use TEST_DATABASE_URL if supplied, otherwise
DATABASE_URL. Each run creates a random `atc_import_test_...` schema, applies the
migration there, tests concurrent import, exact counts, password verification,
idempotency and rollback, and drops only that test schema. Existing application
data is untouched. The database user needs permission to create schemas.

To inspect the local data from the repository root:

```sh
docker compose exec -T postgres psql -U atc_user -d atc_quiz -c 'SELECT role, count(*) FROM "User" GROUP BY role;'
```

For interactive inspection, run `docker compose exec postgres psql -U atc_user -d
atc_quiz`, then paste SQL such as:

```sql
SELECT c.name, count(u.id) AS students
FROM "Class" c LEFT JOIN "User" u ON u."classId" = c.id
GROUP BY c.name ORDER BY c.name;
SELECT title, language, status, "negativeMarking", "opensAt", "closesAt" FROM "Quiz";
SELECT count(*) FROM "Question";
SELECT count(*) FROM "Option";
```
