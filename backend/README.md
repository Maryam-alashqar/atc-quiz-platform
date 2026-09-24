# ATC Quiz Platform — Backend

NestJS + TypeScript, PostgreSQL and Prisma. Implemented so far: the data model,
transactional CSV import/demo seed, cookie-based JWT login/logout/current user,
role guards, teacher/admin quiz management, timed student attempts with scoring,
and a database-backed health endpoint.

## Local setup

1. From the repository root: `docker compose up -d postgres`.
2. In `backend`, copy `.env.example` to `.env` if it does not exist. Configure
   DATABASE_URL and FRONTEND_ORIGIN and generate a JWT_SECRET as described in
   [authentication setup](docs/authentication.md).
3. Run:

```sh
npm ci
npm run db:deploy
npm run db:seed
npm run start:dev
```

In PowerShell use `npm.cmd` if the `npm.ps1` wrapper is blocked.
The API runs on `http://localhost:3000/api` by default. Verify it with
`GET /api/health`. Full frontend/backend Docker startup is a later stage.

## Documentation

- [Authentication API, manual login and environment settings](docs/authentication.md)
- [Quiz management API, publication rules and feature tests](docs/quiz-management.md)
- [Student attempts, answer saving, deadlines and scoring](docs/student-attempts.md)
- [CSV format, demo credentials and repeat-import behavior](prisma/data/README.md)
- [Schema, migrations and database constraints](prisma/README.md)
- [Implementation decisions](../DECISIONS.md)
- [AI usage and verification](../AI_USAGE.md)

## Feature tests

```sh
npm test
npm run test:e2e
npm run test:db
npm run typecheck
npm run lint
npm run build
```

Test output lists each scenario by name. For one feature only:

```sh
npm run test:e2e -- test/auth-login.e2e-spec.ts
```

HTTP and database integration tests require PostgreSQL. They create and remove
only isolated test schemas; development data is preserved. TEST_DATABASE_URL can
point tests at a separate database, otherwise they use DATABASE_URL.

Teacher results/export is the remaining backend feature stage before the frontend.
