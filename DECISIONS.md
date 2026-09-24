# Implementation decisions

This record covers the database, CSV-import and authentication stages implemented so far.
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
  the database stores hashes.
- Imported questions always contain four distinct options and one correct choice.
  Drafts imported through CSV must also be complete; the future authoring UI can
  support incomplete drafts with stricter checks at publication.

- Authentication uses a one-hour JWT in an HttpOnly, SameSite=Lax cookie, Secure
  in production. Current roles are loaded from the database for each request.
  Routes require authentication by default; admins access only explicitly allowed
  roles. Resource ownership will be enforced in quiz services.
- Cookie-authenticated writes require an exact trusted Origin, including login
  and logout. Local API clients must supply it explicitly. CORS allows only the
  configured frontend, and login attempts are limited per IP in the single process.
- Logout clears the cookie; copied JWTs remain valid until expiry because this
  MVP has no session revocation store or refresh-token flow.
- Feature tests use explicit scenario names and verbose reports. Nest HTTP tests
  run against isolated PostgreSQL schemas and include real validation and guards.

Still to implement: quiz management, timed attempts
and scoring, results/export, the application UI, full Compose startup and delivery
documentation. A next-week enhancement plan will be completed with the final MVP.
