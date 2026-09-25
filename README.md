# ATC Quiz Platform

Timed multiple-choice quizzes for **ATC — Amman Tutoring Center**. Students take quizzes on their phones and see their score as soon as they submit. Teachers write, schedule and publish quizzes and follow the results. The centre's admin sees participation across classes and teachers and manages accounts. The interface is in Arabic and English, and each quiz can be in either language.

- [DECISIONS.md](DECISIONS.md): assumptions, additions beyond the brief, omissions, next steps
- [AI_USAGE.md](AI_USAGE.md): how AI tools were used and checked
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md): the brief broken down into requirements

## Run it

Requires Docker (Docker Desktop on Windows/macOS). From the repository root:

```sh
docker compose up --build
```

Open **http://localhost:8080** when the log shows `Nest application successfully started`. The first build takes a few minutes.

On start, the backend applies database migrations and loads the sample data automatically. Restarting keeps everything, including attempts and changed passwords. To start again from an empty database:

```sh
docker compose down -v
docker compose up --build
```

> Use `localhost`, not `127.0.0.1`: the API only accepts requests from the exact origin it was configured with.
> If port 8080 or 5432 is taken: `APP_PORT=8090 POSTGRES_PORT=5434 docker compose up --build`, then open http://localhost:8090.

## Demo accounts

All demo accounts use the password **`AtcDemo2026!`**. There is no sign-up: accounts come from the spreadsheet import or are created by the admin.

| Role | Username | Name | Notes |
| --- | --- | --- | --- |
| Admin | `admin` | نور الحسن | Centre dashboard, all quizzes, user management |
| Teacher | `teacher-math` | رنا الخطيب | Owns the two Arabic maths quizzes |
| Teacher | `teacher-english` | سامي النجار | Owns the English quiz (with negative marking) |
| Teacher | `teacher-physics` | هبة العبادي | Owns the upcoming Arabic physics quiz |
| Teacher | `teacher-science` | مازن التميمي | Owns a draft |
| Student | `s10a-01` … `s10a-20` | | Class 10A |
| Student | `s10b-01` … `s10b-20` | | Class 10B |
| Student | `s11a-01` … `s11a-20` | | Class 11A |

Each student can take each quiz **once**, so use a different student for each try.

**Suggested walk-through**
1. Sign in as `s10a-05`. Open *English Grammar: Weekly Review*, start it, answer a few questions, **reload the page** (the timer and answers survive), then submit.
2. Sign in as `teacher-english`. The dashboard shows how many have finished the quiz and how many haven't started. Open it to see exactly who hasn't, or download the results as CSV.
3. Sign in as `teacher-math`. Look at *My Students*, then create a quiz for **named students** (for example two students from 10B). Try publishing it incomplete to see the checks. Then sign in as one of those students and as a classmate who wasn't named: only the named student sees it.
4. Sign in as `admin` and look at the dashboard, then add a student under *Users* and sign in with the details it shows.

Use the language button to switch between العربية and English. Try it at phone width.

## Sample data

The sample data lives in [`backend/prisma/data/`](backend/prisma/data/) as four CSV files, the same shape the centre's spreadsheets will be exported to:

| File | Contents |
| --- | --- |
| `classes.csv` | 10A, 10B, 11A |
| `users.csv` | 60 students with Arabic names, 4 teachers, 1 admin |
| `quizzes.csv` | 5 quizzes: open (Arabic, no negative marking), open (English, lose 25%), upcoming (Arabic, fixed penalty), closed, draft |
| `questions.csv` | 15 questions per quiz, four options each, worth 1, 1.5 or 2 points |

Docker loads them on start. They are loaded by **the same importer** used for real spreadsheets.

### Loading the real spreadsheets

Export the four sheets as UTF-8 CSV with the column headers described in [backend/prisma/data/README.md](backend/prisma/data/README.md), put them in one folder, and run:

```sh
docker compose cp ./my-csv-folder backend:/tmp/import
docker compose exec backend node dist/data/cli.js import /tmp/import
```

Each import runs in a single transaction: either every row is saved or none is. The importer adds new classes, users and quizzes and never overwrites existing ones, so re-importing the same export is safe. Errors name the file and row.

> Git Bash on Windows rewrites paths that start with `/`. Prefix those commands with `MSYS_NO_PATHCONV=1`, or run them in PowerShell.

## Development without Docker for the app

Needs Node.js 22 and **npm 11**, which wrote the lock files (`npm install -g npm@11`). PostgreSQL still runs in Docker.

```sh
docker compose up -d postgres

cd backend
cp .env.example .env        # then set JWT_SECRET, e.g. node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm ci
npm run db:deploy
npm run db:seed
npm run start:dev           # API on http://localhost:3000/api

cd ../frontend
npm ci
npm run dev                 # app on http://localhost:5173 (proxies /api to :3000)
```

## Tests

| Command | What it covers |
| --- | --- |
| `cd backend && npm test` | Scoring, timing, CSV validation, password hashing, participation and follow-up statistics, result CSV escaping |
| `cd backend && npm run test:e2e` | The HTTP API against real PostgreSQL: auth and roles, quiz rules and locks, one attempt per student (including concurrent starts), deadlines and grace period, negative marking, answer-key redaction, ownership, named-student quizzes (a classmate who wasn't named can't see or start one), rosters, dashboards, admin accounts |
| `cd backend && npm run test:db` | The CSV importer against PostgreSQL: concurrent imports, repeat imports, rollback |
| `cd frontend && npm test` | Server-clock countdown, Amman-time conversion, the answer-save queue (retries, coalescing), quiz form validation and conversion, sign-out |

Backend e2e and DB tests need PostgreSQL running (`docker compose up -d postgres`) and `backend/.env`. Each test file uses its own throwaway schema, so your data is not touched.

## Project layout

```
backend/            NestJS API
  prisma/           schema, migrations, sample CSV data
  src/auth          cookie JWT sessions, role guards, login rate limit
  src/quizzes       teacher/admin quiz management and publishing rules
  src/attempts      timed attempts, answer saving, scoring
  src/results       per-quiz results, who has not started, CSV export
  src/users         admin account management, student lookup
  src/overview      admin and teacher dashboards, My Students
  src/data          CSV parser, importer and CLI (seed/import)
  test/             e2e tests against PostgreSQL
  docs/             API notes per feature
frontend/           React app (Vite, Tailwind), served by nginx in Docker
  src/features      student, manage (teacher dashboard, quizzes, students), admin, auth
  src/lib           time, answer queue, password generator (pure, tested)
  src/i18n          English and Arabic dictionaries
docker-compose.yml  postgres + backend + frontend
```
