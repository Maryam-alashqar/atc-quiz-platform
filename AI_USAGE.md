# AI usage

Codex assisted with reviewing the supplied brief and the user's implementation
scope, inspecting the React/NestJS starter, and implementing the database and
CSV-import, authentication, quiz-management and student-attempt stages. The user chose the stack
and scope, requested backend-first work in separate stages, and approved merging
the completed database, CSV, authentication and quiz-management branches into main.

Codex authored the Prisma schema, SQL migration/check constraints, database
regression checks, CSV parser/importer, fictional demo records/questions, password
hash helpers, Nest configuration/Prisma integration, cookie authentication,
authorization guards, quiz management, student attempts/scoring and supporting documentation. The user requested clear
feature-test names; tests were grouped and named by observable behavior. The demo seed calls the same importer
as ordinary CSV imports; no real student records were used.

Verification performed during these stages:

- Prisma schema validation, client generation, migration application and status,
  and a schema comparison against the running PostgreSQL database.
- SQL regression checks for invalid relations, duplicate attempts/answers,
  numeric/timing constraints, deletion protection, Arabic and decimal storage.
- Unit tests for CSV format/reference/value validation and password verification.
- PostgreSQL integration tests in a disposable schema for simultaneous imports,
  exact record counts, repeat-import preservation, and atomic rollback on conflicts.
- Backend build, TypeScript checking and lint.
- Real Nest/PostgreSQL HTTP tests for student/teacher/admin login, safe cookies and
  responses, malformed credentials, JWT expiry/signature/claims, logout, role
  restrictions and role changes, trusted origins, CORS and login throttling.
- A compiled-server smoke check against the seeded development database: health,
  login/current user/logout, untrusted-origin rejection and absence of test routes.
- Quiz HTTP tests for draft CRUD, classes, pagination, publishing, strict nested
  validation, teacher ownership, admin access, and edit/deletion protection after
  attempts exist. A coordinated database concurrency test verifies that a racing
  edit waits for an attempt insert and then rejects the grading change.

The user also reported that the database-stage verification commands worked.
AI-generated sample questions are illustrative demo content, not a reviewed
curriculum. The starter endpoint/test was replaced by a database-backed health
endpoint and feature-level auth/quiz tests. Student attempt timing and scoring
API tests cover availability, persistence, weighted and negative scoring, server
deadline/grace boundaries, lazy expiry, ownership, input validation, answer-key
redaction and concurrent start/save/submit requests. A coordinated quiz-lock test
checks that starting waits for a grading edit and reads its committed points.

Codex also implemented teacher/admin result reporting and CSV export with
ownership checks before lazy expiry, paginated rows and quiz-wide statistics.
Verification covers access restrictions, expiry from saved answers, safe response
fields, pagination, empty reports, Arabic CSV round-tripping and spreadsheet
formula protection. The results feature reuses the existing attempt scoring logic.

This file will be updated as further stages are implemented and verified.
