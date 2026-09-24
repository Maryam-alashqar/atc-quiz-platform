# AI usage

Codex assisted with reviewing the supplied brief and the user's implementation
scope, inspecting the React/NestJS starter, and implementing the database and
CSV-import stages. The user chose the stack and scope, requested backend-first
work in separate stages, and approved merging the database stage into main.

Codex authored the Prisma schema, SQL migration/check constraints, database
regression checks, CSV parser/importer, fictional demo records/questions, password
hash helpers and supporting documentation. The demo seed calls the same importer
as ordinary CSV imports; no real student records were used.

Verification performed during these stages:

- Prisma schema validation, client generation, migration application and status,
  and a schema comparison against the running PostgreSQL database.
- SQL regression checks for invalid relations, duplicate attempts/answers,
  numeric/timing constraints, deletion protection, Arabic and decimal storage.
- Unit tests for CSV format/reference/value validation and password verification.
- PostgreSQL integration tests in a disposable schema for simultaneous imports,
  exact record counts, repeat-import preservation, and atomic rollback on conflicts.
- Backend build, TypeScript checking, lint and the existing starter E2E test.

The user also reported that the database-stage verification commands worked.
AI-generated sample questions are illustrative demo content, not a reviewed
curriculum. The existing E2E test only exercises the starter endpoint; auth,
timing, scoring and ownership API tests are not implemented yet.

This file will be updated as further stages are implemented and verified.
