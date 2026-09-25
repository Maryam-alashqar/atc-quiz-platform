# Decisions

Nour's brief is short and was written quickly. This file lists what I assumed where it left gaps, what I built that she didn't ask for, what I left out on purpose, and what I would do next. The full requirements breakdown is in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Stack

React + TypeScript (Vite, Tailwind) for the frontend, NestJS + TypeScript for the API, PostgreSQL through Prisma, all started by Docker Compose. One language across the whole stack keeps the API types and the UI types close. PostgreSQL gives real constraints (unique attempts, composite foreign keys, row locks) for the rules that must not break under concurrent requests.

## Assumptions

**Who uses it**
- Three roles: **Student**, **Teacher**, and **Admin**. The Admin role is Nour: she asked to "see how the students did" across the centre, and she is not a teacher.
- A student belongs to exactly one class. The teacher who creates a quiz owns it.
- A quiz is for **whole classes** (one or more), or for **named students** from any class, such as a catch-up quiz for three students. "It depends on the teacher and the quiz" applies to who takes a quiz as much as to how it is marked.
- Students sign in with a **username** (for example `s10a-07`), not an email address. Many students won't have one, and the real list arrives as a spreadsheet.
- There is no self sign-up. Accounts come from the spreadsheet import or are created by the admin.

**Quizzes**
- Each question has exactly four options and one correct answer, and its own point value. Points can be fractional, such as 1.5.
- A quiz has a time limit (default 20 minutes) and an open/close window. Times are entered and shown in **Asia/Amman** time and stored as instants.
- The timer starts when the student presses Start, on the server. It is `min(start + time limit, closing time)`. Refreshing, closing the tab or switching phones never resets it.
- A 10-second grace period absorbs network delay at the deadline. After that, the server grades whatever answers were saved.
- "Students should not be able to take a quiz twice" means one attempt per student per quiz, ever. There are no retakes.

**Negative marking** ("depends on the teacher and the quiz")
- It is set per quiz, with three modes:
  - **None**
  - **Fraction:** a wrong answer loses a percentage of *that question's* points. This is the default when marking is enabled, because a flat penalty is unfair when questions carry different points.
  - **Fixed:** a wrong answer loses the same number of points on every question.
- An unanswered question never loses points.
- A total below zero is shown as zero.

**Results**
- Students see their score and percentage immediately after submitting. They do **not** see the correct answers, so they can't pass them to classmates who take the quiz later. The teacher can go through the answers in class.
- Teachers see results for their own quizzes. The admin sees everything.

**Data**
- The real data will arrive as spreadsheets. The admin loads them on the *Import* page: one Excel workbook with four sheets (classes, users, quizzes, questions), or the same tables as CSV files. The file is checked and the page shows exactly what will change before anything is saved. The sample data uses the **same importer** and validation, which shows the data really is loadable. A command-line version exists for bulk or scripted loads.

## Built beyond the brief, and why

| Addition | Why |
| --- | --- |
| **Admin dashboard** | Head counts, participation rate and average score per class and per teacher, quizzes to follow, quiz status, and latest submissions. This is how Nour "sees how the students did" without opening every quiz. *Participation* = finished attempts ÷ the students each opened quiz is meant for. |
| **Teacher dashboard** | The same view limited to the teacher's own quizzes. For each quiz it shows how many finished, are in progress, or have not started, so the teacher knows whom to chase before it closes. |
| **Who has not started** | Each quiz's results open on a list of every student it is meant for, filterable to exactly who has not started. The brief's "see how the students did" includes the ones who didn't take it. |
| **My Students** | Each of a teacher's students with their progress on that teacher's quizzes: finished, open but not started, missed, and average. |
| **Quizzes for named students** | The teacher picks "Whole classes" or "Named students" in the editor, with a searchable picker. One server rule decides access for every student request, and dashboards and rosters count expected students the same way. |
| **Account management for the admin** | Add a student or teacher with a generated first password (shown once to hand over), fix names and classes, and reset forgotten passwords. Without sign-up, a new student mid-term would otherwise need a developer. |
| **Upcoming quizzes for students** | "Opens tomorrow" on the dashboard, so students can plan. They can't be opened early. |
| **Answers saved on every tap** | Most students are on phones, often on patchy connections. A queue retries saves until they succeed, and the timer keeps running on the server. A dropped connection or a timeout loses nothing that was already chosen. |
| **Resume after a refresh** | The attempt reopens at the first unanswered question, with the same deadline. |
| **Auto-submit at zero** | The client submits when the countdown ends. If the page is closed, the server grades the saved answers the next time anyone touches the attempt. |
| **Arabic and English interface** | The UI switches between Arabic (RTL) and English. Each quiz has its own language: an Arabic quiz renders right-to-left, with أ ب ج د option letters, inside either interface. |
| **CSV export of results** | For teachers who keep grades in Excel. It is UTF-8 with a BOM so Arabic names open correctly, and cells that could run as spreadsheet formulas are neutralised. |
| **Quiz editing locks** | Once any student has started a quiz, only its title and description can change. Otherwise the points and answers could shift under students who already submitted. |
| **Duplicate a quiz** | Weekly quizzes are often last week's with small changes. The copy keeps the questions, marking and audience but clears the dates, and saving creates a new quiz. The original and its results are untouched. |
| **Change your own password** | Everyone starts with a password the admin handed out. The current password is required before a new one is accepted, and attempts are rate-limited per account. |
| **Nothing lost by accident** | The editor asks before leaving with unsaved changes. The quiz page asks before leaving and says the timer keeps running, and it warns at 5 minutes and 1 minute left. Each page names the browser tab, which helps students with several tabs open. |
| **Spreadsheet import page** | "The real data will arrive as spreadsheets": the admin uploads the Excel file itself (or CSV), sees a check of exactly what will be added and what already exists, or the sheet and row of each problem, and only then imports. The check runs the real import and rolls it back, so it can't disagree with the result. |
| **Login rate limit per account** | Limiting by IP alone would lock a whole class out when the quiz starts, because everyone on the centre's Wi-Fi shares one public IP. The limit is per IP *and* username. |

## Deliberately left out

- **Column mapping for spreadsheets laid out differently.** The import expects our sheet and column names (the example workbook shows them). Mapping someone else's columns onto ours is next week's work.
- **Password reset by email, and forcing a password change on first login.** The admin hands out and resets passwords, and every user can change their own. That covers a small centre where everyone is known by name.
- **Deleting or deactivating accounts.** Attempts reference the student, and old results must stay intact. Deactivation is the right fix. Deletion isn't.
- **Teachers moving students between classes.** A student's class decides the quizzes of every teacher, so class changes stay with the admin. A teacher who wants a quiz for particular students names them on the quiz instead.
- **Retakes, question banks, random question order, timed-per-question quizzes.**
- **Showing correct answers after the quiz closes.** This is a sensible next step (see below). It stays off until Nour decides.
- **Session revocation.** Signing out clears the cookie, and a copied token stays valid until it expires (1 hour).
- **Email/SMS notifications, proctoring, and multi-branch organisations.**

## Known limitations

- **Docker runs on plain HTTP.** Compose runs the API with `NODE_ENV=development`. In production the API refuses a non-HTTPS origin and sets `Secure` cookies. Some browsers (Safari) won't store `Secure` cookies on `http://localhost`, so the local setup can't use production mode.
- **Participation figures use each student's current class.** Moving a student doesn't rewrite history, but their old attempts no longer count towards either class's rate.
- **Expiry is lazy.** An abandoned attempt past its deadline is graded the next time anything reads it: the student, the quiz's results, or a dashboard, which each grade overdue attempts before reporting. There is no background worker. That's enough at this size, but a scheduled job would be better at scale.
- **The audience is frozen with the questions.** Once a student has started, the classes and named students can't change, just like the points. To include someone later, the teacher makes a second quiz for them.
- **The CSV import creates whole-class quizzes.** Quizzes for named students are made in the editor.
- **Excel date cells are read as Amman time (UTC+3).** Jordan has used UTC+3 all year since 2022. Dates typed as text must include their offset, as in the CSV files.
- **Sessions last one hour.** A student who signed in 55 minutes before starting may be sent back to the sign-in page mid-quiz. Their answers and deadline are kept, and they resume after signing in again.

## Next week

1. **Column mapping on import:** accept spreadsheets with different sheet or column names by letting the admin match them to ours. The upload, check and import already exist.
2. **Answer review** after a quiz closes, per quiz, switched on by the teacher.
3. **Question analysis for teachers:** how many students chose each option, to find questions that were unclear.
4. **Deactivate accounts**, and require a password change on first login.
5. **Sessions:** short access tokens with a refresh token and server-side revocation.
6. **Deployment:** HTTPS behind a proxy, production mode, automatic database backups, and error monitoring.
7. **Browser end-to-end tests in CI** (Playwright) for the student quiz flow on a phone-sized screen. The flows were checked in a real browser during development, but those scripts weren't committed as tests.
