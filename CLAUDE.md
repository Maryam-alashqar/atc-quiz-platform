# ATC Quiz Platform: notes for Claude Code

Timed multiple-choice quizzes for a tutoring centre. Roles: STUDENT, TEACHER, ADMIN. Read `docs/REQUIREMENTS.md` and `DECISIONS.md` before changing behaviour.

## Layout and commands

- `backend/`: NestJS + Prisma 7 (PostgreSQL). `npm run typecheck`, `npm run lint`, `npm test` (unit), `npm run test:e2e` (needs `docker compose up -d postgres` and `backend/.env`), `npm run test:db`.
- `frontend/`: React + Vite + Tailwind v4. `npx tsc -b --noEmit`, `npm run lint`, `npm test`, `npm run dev` (proxies `/api` to :3000).
- Whole app: `docker compose up --build` → http://localhost:8080.
- npm 11 wrote the lock files; use it (the Docker images pin it).

## Rules that must not break

- **The server decides.** Scoring, deadlines, availability and ownership are enforced in the API. The UI only mirrors them. Never accept scores, points or deadlines from the client.
- **Answer keys never reach students.** Student responses are explicit projections without `isCorrect`, even after grading.
- **Who a quiz is for.** Every student-facing query uses `assignedTo()` (in `attempts.service.ts`): whole classes, or named students. Counts of expected students use `meantFor()` in `overview-stats.ts`. Don't add a second version of either.
- **One attempt per student per quiz.** This is a database unique key plus locks. Keep new attempt logic inside the existing lock helpers.
- **Time.** Deadlines come from the server (`deadlineAt`, `serverTime`). The UI shows Asia/Amman time. Decimals travel as strings.
- **Grading stays stable.** After the first attempt starts, only a quiz's title and description may change.
- **Bilingual UI.** Every UI string goes in both `frontend/src/i18n/en.ts` and `ar.ts` (the types enforce parity). Wrap user-entered text in `<bdi>` or set `dir` from the quiz language. Check layouts in RTL.
- **Phones first.** Touch targets are at least 44px, and nothing may overflow at 390px wide.
- **Sample data** loads through the CSV importer (`backend/prisma/data/`), the same path as real spreadsheets. Keep them in sync.

## Working style

- One feature per `feat/...` branch, small commits, merged into `main` with `--no-ff`.
- Pure logic (scoring, statistics, time, answer queue, form conversion) goes in plain functions with unit tests. HTTP behaviour and abuse cases go in e2e tests with scenario names that read as behaviour.
- Check UI changes in a real browser at 390px and 1280px, in both languages, before calling them done.
- Record new assumptions or scope changes in `DECISIONS.md`.
