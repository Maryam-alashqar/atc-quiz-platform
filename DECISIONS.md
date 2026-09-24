# Implementation decisions

This record covers the database and CSV-import stages implemented so far.
Application/API decisions will be added as those stages are built.

- PostgreSQL + Prisma fit the relational quiz data and provide migrations and
  database constraints. Docker Compose currently runs PostgreSQL; full application
  startup in Compose is still pending.
- A student belongs to one class. Quizzes may be assigned to multiple classes.
  Teachers own quizzes; an ADMIN role is included for planned centre-wide access.
- Composite foreign keys prevent answers from crossing question/quiz boundaries;
  a unique student/quiz key prevents repeat attempts. Decimal values preserve
  fractional scoring precision; timestamps store instants using timestamptz.
- Negative marking has NONE, FRACTION and FIXED modes. These modes and the
  administrator role extend the original brief and are part of the chosen scope.
- The sample data uses the same CSV importer as future spreadsheet exports:
  three classes, 60 students, four teachers, one admin and five 15-question quizzes.
  CSV is supported now; XLSX and an upload/mapping UI are deliberately deferred.
- Imports are self-contained and append-only. Existing usernames/classes/quiz IDs
  are reused, never silently overwritten. Role/class or quiz-owner conflicts reject
  the entire batch. This preserves user passwords, teacher edits and attempts when
  startup seeding is repeated. The importer is a trusted local command, not an API.
- File validation precedes a single database transaction. Import processes share
  a transaction-level advisory lock to prevent concurrent duplicate creation.
- Demo availability dates are relative on first seed so a fresh reviewer setup
  has open, upcoming and closed examples. Subsequent seeds preserve stored dates.
- Passwords use Node's asynchronous scrypt with independent random salts. Known
  plaintext credentials appear only in the intentionally public demo CSV/documentation;
  the database stores hashes. Authentication endpoints are a subsequent stage.
- Imported questions always contain four distinct options and one correct choice.
  Drafts imported through CSV must also be complete; the future authoring UI can
  support incomplete drafts with stricter checks at publication.

Still to implement: authentication/authorization, quiz management, timed attempts
and scoring, results/export, the application UI, full Compose startup and delivery
documentation. A next-week enhancement plan will be completed with the final MVP.
