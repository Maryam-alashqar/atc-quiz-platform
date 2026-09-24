# Teacher/admin results and CSV

Both endpoints require the authentication cookie. Teachers can access only
quizzes they own; admins can access all quizzes. Students receive 403, anonymous
requests 401, and missing or another teacher's quizzes 404. Responses use
`Cache-Control: no-store`.

- `GET /api/quizzes/:id/results?page=1&pageSize=20` returns quiz ID/title, total,
  page/pageSize, summary and items. Page size is at most 100.
- `GET /api/quizzes/:id/results/export` downloads every attempt for that quiz,
  independent of the results page, as `quiz-<uuid>-results.csv`.

Each item contains attempt ID/status, started/deadline/submitted timestamps,
score, maxScore, percentage, and student ID/username/name/current class. Scores
and percentages are decimal strings. Unfinished scores/percentages are null in
JSON and empty in CSV. No password hashes or question/answer keys are returned.
Rows sort by start time descending, then attempt ID ascending for stable pages.

The summary counts in-progress, submitted, expired and completed attempts.
Average (rounded to two places), lowest and highest scores include only completed
attempts, including expired attempts. Statistics cover the entire quiz, not just
the current page; empty completed sets return null statistics. Count, statistics
and rows are read in one repeatable-read transaction. These are attempt reports:
students who have not started are not included. Class is the student's current
class, not an enrollment snapshot from when the attempt began.

Authorization runs before lazy expiry. Authorized reads/exports finalize overdue
attempts using the same locking/scoring service as student requests. Attempts
crossing their grace deadline during a report request are finalized on the next
request. Concurrently completed attempts are reflected according to the report's
database snapshot; there is no background expiry worker.

CSV uses UTF-8 with BOM for Arabic spreadsheet compatibility, quoted cells,
escaped double quotes and CRLF rows. Timestamps are ISO UTC. Text that could be
interpreted as a spreadsheet formula is prefixed with an apostrophe. Export is
in-memory, appropriate for this assessment's class-sized datasets; large-scale
streaming exports are deferred.

## Verify

After starting PostgreSQL, run from `backend`:

```sh
npm test -- src/results
npm run test:e2e -- test/quiz-results.e2e-spec.ts
```

Use `npm.cmd` in PowerShell when npm.ps1 is blocked. Tests cover teacher/admin
access, unauthorized requests without expiry side effects, pagination/statistics,
saved-answer expiry, empty results, Arabic CSV escaping and formula protection.

For a manual check, complete a student attempt using [student attempts](student-attempts.md),
then log in as its teacher using [authentication](authentication.md). Open the
results endpoint using that quiz ID; append `/export` to download its CSV. The
API can be tested now; the browser results screen belongs to the frontend phase.
