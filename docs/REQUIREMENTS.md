# ATC Quiz Platform — Requirements & Scope

**Purpose:** translate Nour's client brief into an implementable MVP, record the gaps in the brief and how they were resolved, and keep the project small enough to deliver reliably within the assessment window.

Status legend: ✅ done · 🚧 in progress · ⏳ planned

---

## 1. Product concept

A mobile-first, bilingual (Arabic/English) quiz platform for a tutoring centre. Students take timed multiple-choice quizzes and see their score. Teachers create and publish quizzes and review student performance. The centre owner (Admin) sees everything.

- **Name:** ATC — Amman Tutoring Center
- **Visual direction:** educational, institutional, modern
- **Style:** rounded cards, generous whitespace, subtle shadows

| Token | Hex | Use |
| --- | --- | --- |
| Primary Academic Blue | `#1F4E79` | Primary actions, headers |
| Secondary School Blue | `#4F7CAC` | Secondary actions, links |
| Pencil Gold | `#E9B44C` | Highlights, deadlines, timer warnings |
| Warm Ivory | `#F7F5EF` | Page background |
| Surface White | `#FFFFFF` | Cards |
| Deep Navy | `#172B3A` | Body text |
| Light Blue Surface | `#DCE8F2` | Selected states, subtle panels |

## 2. Technical stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Fast, clear component structure |
| UI | Tailwind CSS | Fast responsive work, consistent design tokens |
| Backend | NestJS + TypeScript | Structured modules, pairs naturally with a TS frontend |
| Database | PostgreSQL | Relational fit for users, classes, quizzes, attempts, answers |
| ORM | Prisma 7 (`@prisma/adapter-pg`) | Readable schema, migrations, typed client |
| Auth | JWT in an HttpOnly cookie | Role-based auth without tokens in `localStorage` |
| Runtime | Docker Compose | One-command startup for reviewers |
| Tests | Vitest + Supertest against real PostgreSQL | Scoring, attempt rules and authorization first |

## 3. Requirements from the client brief

| ID | Requirement | Status |
| --- | --- | --- |
| FR-01 | Users log in; at minimum Student and Teacher roles exist | ✅ backend |
| FR-02 | Students see quizzes available to them | ✅ backend |
| FR-03 | A quiz has a time limit, typically 20 minutes | ✅ backend |
| FR-04 | A quiz has an opening and closing date/time | ✅ backend |
| FR-05 | Students take multiple-choice quizzes | ✅ backend |
| FR-06 | Each question has four options | ✅ backend |
| FR-07 | Each question has its own point value | ✅ backend |
| FR-08 | A student cannot take the same quiz twice | ✅ backend |
| FR-09 | Students see their score after completing a quiz | ✅ backend |
| FR-10 | Teachers enter/create quizzes | ✅ backend |
| FR-11 | Negative marking can be enabled or disabled per quiz | ✅ backend |
| FR-12 | Teachers see how students performed | ✅ backend |
| FR-13 | Arabic names and Arabic quiz content work correctly | ✅ backend · ⏳ RTL UI |
| FR-14 | The interface works well on phones | ⏳ frontend |
| FR-15 | Sample data: classes 10A, 10B, 11A, ~20 students each, four teachers | ✅ |
| FR-16 | A realistic sample quiz: ~15 questions, four options each | ✅ |
| FR-17 | Sample data is loadable, since real data will arrive as spreadsheets | ✅ CSV importer |

## 4. Gaps in the brief and decisions taken

| Topic | Decision |
| --- | --- |
| **Quiz assignment** | Each quiz is assigned to one or more classes. Only students in those classes can see or start it. |
| **Negative-mark formula** | Per quiz: `NONE`, `FRACTION` or `FIXED`. `FRACTION` (the default when enabled) subtracts a fraction of the question's own points, e.g. 0.25 × points, because a flat penalty is unfair when questions carry different points. `FIXED` subtracts a set value per wrong answer. Correct = question points; unanswered = 0; the final score is floored at 0. |
| **Attempt timing** | The timer starts when the server creates the attempt. Refreshing or reopening does not reset it. Expiry is enforced on the first read or write after the deadline, with a 10-second grace period for network delay, so no cron job is needed. |
| **One attempt** | Enforced both in application logic and by a unique database constraint on `(quizId, studentId)`, which also covers concurrent start requests. |
| **Timezone** | Timestamps are stored as `timestamptz`. The UI displays them in Asia/Amman. |
| **Quiz ownership** | A teacher manages, and sees results for, only the quizzes they created. Another teacher's quiz returns 404, not 403, so its existence is not revealed. |
| **Draft/Published** | Students only see quizzes that are published, currently open and assigned to their class. |
| **Editing live quizzes** | Once any attempt has started, only the title and description can change. Questions, points, timing and marking are locked to keep grading consistent. |
| **Score visibility** | Total score and percentage are shown right after submission. Correct answers are not revealed, to reduce answer sharing. |
| **Language/RTL** | All text is UTF-8. Each quiz has a language (`AR`/`EN`). Arabic quizzes render RTL, and the app shell works in both directions. |
| **Spreadsheet import** | A working CSV importer, with sample CSVs that mirror the expected spreadsheet structure. The seed uses the same importer, which shows the data really is loadable. A full XLSX upload UI is deferred. |
| **Login identifier** | Username, not email (e.g. `s10a-07`), because students may not have email addresses. |
| **Answer persistence** | Each selected answer is saved to the server immediately. If connectivity drops or time runs out, scoring uses the answers already saved. |
| **Numeric precision** | Points, penalties and scores are stored as `Decimal`, not `Float`, to avoid rounding errors with fractional penalties. |
| **Password recovery** | Not in the MVP. Demo credentials are seeded. |
| **Admin** | An Admin role for Nour, with centre-wide visibility of quizzes and results. She asked to "see how the students did", and she is not a teacher. |
| **CSRF** | Cookie auth is combined with `SameSite=Lax` and a trusted-origin check on state-changing requests. |

## 5. Core user flows

**Student:** Login → Dashboard (available, upcoming and completed quizzes) → Quiz details → Start confirmation → Timed quiz → Submit or time out → Score page.

**Teacher:** Login → Dashboard → Quiz list → Create/edit quiz → Add ~15 questions with options and points → Set classes, time limit, availability window and negative marking → Publish → Results (with CSV export).

**Admin:** Login → All quizzes across teachers → Results for any quiz.

## 6. Data model (as implemented)

| Model | Fields |
| --- | --- |
| `User` | id, username (unique), name, passwordHash (scrypt), role (`STUDENT`/`TEACHER`/`ADMIN`), classId? |
| `Class` | id, name (unique: 10A / 10B / 11A) |
| `Quiz` | id, teacherId, title, description, language (`AR`/`EN`), durationMinutes, opensAt, closesAt, status (`DRAFT`/`PUBLISHED`), negativeMarking (`NONE`/`FRACTION`/`FIXED`), penaltyValue |
| `QuizClass` | quizId, classId (composite PK) |
| `Question` | id, quizId, prompt, points, order (unique per quiz) |
| `Option` | id, questionId, text, isCorrect, order (unique per question) |
| `Attempt` | id, quizId, studentId, startedAt, deadlineAt, submittedAt, status (`IN_PROGRESS`/`SUBMITTED`/`EXPIRED`), score, maxScore. Unique on `(quizId, studentId)` |
| `Answer` | attemptId, quizId, questionId, optionId. PK `(attemptId, questionId)`. Composite foreign keys make it impossible at the database level to store an option that belongs to another question or quiz. |

Enrollment is kept as `User.classId`, not a separate table, because a student belongs to exactly one class in the brief.

## 7. Correctness and abuse cases

Each case below is enforced on the server and covered by an automated test.

- Starting the same quiz twice, including two concurrent start requests
- Accessing a quiz not assigned to the student's class (by editing the URL or the API call)
- Starting before `opensAt` or after `closesAt`
- Refreshing, closing or reopening the page to reset the timer
- Answering or submitting after the server-side deadline
- Sending an option ID that belongs to another question or quiz
- Sending points or a score from the client (scoring happens only on the server, and unknown body fields are rejected)
- A teacher reading or editing another teacher's quiz
- Negative marking pushing a score below zero
- Tampered, expired or wrong-algorithm JWTs, and bearer tokens instead of the cookie
- Arabic text, long question text and small phone screens breaking the layout (⏳ frontend)

## 8. API scope

All routes are under `/api`.

```
POST /auth/login | POST /auth/logout | GET /auth/me
GET  /health

Student
GET  /student/quizzes                  available quizzes + own attempt state
GET  /student/quizzes/upcoming         published quizzes that open later (metadata only)
GET  /student/quizzes/:id              quiz details before starting
POST /student/quizzes/:id/attempt      start, or resume the in-progress attempt
GET  /student/attempts                 own attempt history
GET  /student/attempts/:id             questions without isCorrect + saved answers + deadline
PUT  /student/attempts/:id/answers     save one answer
POST /student/attempts/:id/submit      submit → score

Teacher (own quizzes) / Admin (all)
GET/POST          /quizzes
GET/PATCH/DELETE  /quizzes/:id
POST /quizzes/:id/publish
GET  /quizzes/:id/results
GET  /quizzes/:id/results/export       CSV with UTF-8 BOM, so Arabic opens correctly in Excel
GET  /classes
```

Endpoint details are in [`backend/docs/`](../backend/docs/).

## 9. Sample data

Loaded from `backend/prisma/data/*.csv` through the importer. The data set has 3 classes, 60 students with Arabic names (20 per class), 4 teachers, 1 admin and 5 quizzes, each with 15 questions of four options worth 1, 1.5 or 2 points:

| Quiz | Language | State | Marking | Classes |
| --- | --- | --- | --- | --- |
| مراجعة الجبر والهندسة | AR | Open | None | 10A, 10B |
| English Grammar: Weekly Review | EN | Open | Fraction 0.25 | All |
| القوى والطاقة والكهرباء | AR | Upcoming | Fixed 0.5 | 11A |
| مراجعة الأسبوع الماضي: رياضيات | AR | Closed | Fraction 0.25 | 10A, 10B |
| Physics Fundamentals — Draft | EN | Draft | None | 11A |

## 10. Frontend scope

**Principles:** mobile-first, Arabic/English with RTL, large touch targets (≥ 44px), a timer that stays visible, clear progress, and minimal distractions during a quiz.

| Area | Screens |
| --- | --- |
| Shared | Login · App shell with role-based navigation · Language/direction toggle · Loading, empty and error states |
| Student | Dashboard (open / upcoming / completed) · Quiz details + start confirmation · Quiz player (one question per screen on phones, question navigator, save indicator, sticky countdown, auto-submit at zero, resume after refresh) · Result page (score + percentage) |
| Teacher | Quiz list with status · Quiz editor (details, classes, window, duration, marking, 15 questions × 4 options, points; read-only fields once attempts exist) · Publish · Results table + summary + CSV export |
| Admin | All quizzes across teachers · Results for any quiz |

The API is the only source of truth for time: the countdown uses `deadlineAt` and `serverTime` from the API, so a wrong clock on the device cannot extend the quiz.

## 11. Implementation stages

| # | Stage | Status |
| --- | --- | --- |
| 0 | Setup: config, `.env.example` | ✅ |
| 1 | Schema + first migration | ✅ |
| 2 | CSV importer + realistic seed | ✅ |
| 3 | Prisma module, config, auth, guards | ✅ |
| 4 | Teacher quiz management + edit lock after attempts | ✅ |
| 5 | Student attempts + scoring | ✅ |
| 6 | Teacher/Admin results + CSV export | ✅ |
| 7 | E2E tests for abuse/correctness cases | ✅ |
| 8 | Backend Dockerfile: migrate, seed and start automatically | ⏳ |
| 9 | Frontend: design system, auth, app shell | ⏳ |
| 10 | Frontend: student flow | ⏳ |
| 11 | Frontend: teacher/admin flow | ⏳ |
| 12 | Full `docker compose up --build` (db + backend + frontend) | ⏳ |
| 13 | Root README, DECISIONS.md, AI_USAGE.md final pass | ⏳ |

## 12. Deliverables (byThursday)

- Public GitHub repository with the complete source code
- `README.md`: one-command startup, sample-data loading, demo credentials for every role
- `DECISIONS.md`: assumptions, additions beyond the brief, deliberate omissions, next-week plan
- `AI_USAGE.md`: tools used, how they were directed, how output was verified
- Automated tests for critical behaviour
- A commit history that shows how the work progressed

## 13. Docker

Docker Compose is the reviewer path. The target is a single `docker compose up --build` that starts PostgreSQL, applies migrations, seeds the sample data and serves the backend and frontend.

## 14. Deliberately out of scope

- XLSX upload/mapping UI (a CSV importer CLI exists instead)
- Email/SMS notifications
- Password reset and email verification
- Advanced analytics and charts
- Question banks and randomised question order
- Retakes and multiple attempts
- Live proctoring and anti-cheat surveillance
- Multi-branch organisation management
- Production deployment beyond local Docker Compose

## 15. Definition of done

A reviewer clones the repository, runs one documented command, gets seeded data automatically, and logs in as Student, Teacher and Admin. They can complete the main flows on desktop and phone-sized screens, and see that authorization, timing, scoring and the one-attempt rule are enforced by the backend and covered by tests.
