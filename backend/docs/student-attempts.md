# Student quizzes and attempts

All routes below start with `/api/student`, require a logged-in STUDENT cookie,
and return only that student's records. Writes also require the configured
`Origin`. Teachers/admins use their own APIs, not these student routes.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/quizzes?page=1&pageSize=20` | Published, open quizzes assigned to the student's class; metadata and own attempt summary |
| GET | `/quizzes/upcoming?page=1&pageSize=20` | Published quizzes for the student's class that open later, soonest first; metadata only, not startable until `opensAt` |
| GET | `/quizzes/:id` | Safe metadata preview; previously attempted quizzes remain accessible after closing |
| POST | `/quizzes/:id/attempt` | Start or resume the single attempt; no body fields; returns 200 |
| GET | `/attempts?page=1&pageSize=20` | Own attempt history, including unfinished attempts |
| GET | `/attempts/:id` | Restore questions, saved selections, timer and result |
| PUT | `/attempts/:id/answers` | Save `{ "questionId": "uuid", "optionId": "uuid" }`; use `null` for optionId to clear |
| POST | `/attempts/:id/submit` | Grade persisted answers; no body fields; repeated submissions return the same result |

Lists return `{ total, page, pageSize, serverTime, items }`. Page size is limited
to 100. Decimal points, penalties, scores and percentages are strings. Preview
and list responses do not contain question text. Attempt responses include
questions/options and saved answers but **never `isCorrect`**, even after grading.

## Timing and scoring

The server fixes `startedAt` and `deadlineAt` when the attempt starts:
`deadlineAt = min(startedAt + durationMinutes, closesAt)`. Refreshing or starting
again resumes the same ID and deadline. New attempts are allowed at opensAt,
but not at or after closesAt. Completed attempts cannot be retaken (409).

A fixed 10-second acceptance window follows the deadline. Answers and submission
are accepted while server time is strictly before `graceEndsAt`; at that instant
the attempt expires. This is a bounded grace window, not proof that a request was
sent before the deadline. The frontend should stop the visible timer and submit
at `deadlineAt`, using `serverTime` to correct for the device clock.

Expiry is lazy: the next attempt read/write, quiz preview, dashboard or history
request persists EXPIRED and grades saved answers. There is no background worker;
an idle database row can remain IN_PROGRESS until accessed. The exported service
also supports quiz-scoped expiry for the upcoming teacher results API. Expiry
uses the same lock as saving/submitting; a rejected late save or restart still
commits the expired result. `submittedAt` for EXPIRED is when expiry is processed.

Correct answers earn the question's points; unanswered questions earn zero.
Wrong answers earn zero in NONE mode, subtract `points * penaltyValue` in
FRACTION mode, or subtract `penaltyValue` in FIXED mode. The final total is floored
at zero. Decimal arithmetic preserves fractional marks; only the displayed
percentage is rounded, to two decimal places.

Starting locks the quiz before snapshotting maxScore, serializing with teacher
edits. Saving/submitting lock the attempt, so concurrent requests cannot grade
one answer set and store another. Grading fields remain immutable after start.
Other students' attempt IDs return 404; cross-question/quiz answers and forged
score/timing fields return 400. Terminal attempts reject answer writes with 409.

## Verify locally

Start PostgreSQL and run these from `backend` (use `npm.cmd` in PowerShell):

```sh
npm test -- src/attempts
npm run test:e2e -- test/student-quizzes.e2e-spec.ts test/student-attempts.e2e-spec.ts test/student-timing.e2e-spec.ts test/student-authorization.e2e-spec.ts test/student-concurrency.e2e-spec.ts
```

Tests use isolated PostgreSQL schemas and a controllable server clock. Scenario
names describe availability, answer restoration, each scoring mode, expiry
boundaries, ownership and concurrent requests. Development attempts are untouched.

For a manual walkthrough, follow the cookie login in [authentication](authentication.md)
using seeded student `s10a-01` / `AtcDemo2026!`. List quizzes, take an open quiz ID,
start it, save an option using the returned question/option IDs, reload the
attempt, then submit and read history. If seeded availability dates have passed,
create and publish an open quiz as `teacher-math`, assigned to that student's
class, using [quiz management](quiz-management.md). A submitted manual attempt
is permanent for that student/quiz, so use a new quiz for a second walkthrough.
