# Admin: accounts and centre overview

All routes require an ADMIN session cookie; students and teachers receive 403.
Writes also require the configured `Origin` (see [authentication](authentication.md)).

## Accounts

There is no self sign-up. Accounts come from the CSV import or are created here by the admin.
Only STUDENT and TEACHER accounts are managed through the API; admin accounts are
invisible to these routes (404 by ID) and come from the seed.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/users?role=&classId=&search=&page=&pageSize=` | Students and teachers; `search` matches username or name (case-insensitive, Arabic works) |
| POST | `/api/users` | Create `{ username, name, role, classId?, password }`; returns 201 |
| PATCH | `/api/users/:id` | Update `name` and/or `classId` (students only) |
| POST | `/api/users/:id/password` | Set a new password `{ password }`; returns 204 |

- Usernames are trimmed and lowercased and follow the same rule as the importer and login
  (`a-z 0-9 . _ -`, starting with a letter or digit). A taken username returns 409.
- Students must have an existing class; teachers must not have one (400).
- Passwords are 8–128 characters and stored as salted scrypt hashes. Responses never
  include hashes. Unknown fields (for example `passwordHash`) are rejected with 400.
- A password reset does not end sessions that are already signed in; they expire with the
  JWT lifetime (`JWT_TTL_SECONDS`).
- Deleting or deactivating accounts is out of scope: attempts reference the student, and
  results must stay intact.

Rows include `class`, `attemptCount` (students) and `quizCount` (teachers).

## Overview

`GET /api/overview` returns one snapshot for the admin dashboard:

- `counts`: students, teachers, classes, and live / scheduled / closed / draft quizzes.
- `overall`, `classes[]`, `teachers[]`: participation and average score.
- `recent`: the six most recently completed attempts.

**Participation** = completed attempts ÷ expected attempts, where *expected* is, for every
published quiz that has already opened, the number of students currently in each class it
is assigned to. *Completed* means SUBMITTED or EXPIRED. Only attempts by students of an
assigned class count, so a student who changes class does not inflate the new class's rate.
The average score is the mean percentage of those completed attempts.

Expiry is lazy (see [student attempts](student-attempts.md)): an abandoned attempt past its
deadline is counted once any request touches it, for example when its teacher opens the
results. The calculation is a pure function (`src/overview/overview-stats.ts`) with unit tests.

## Verify

```sh
npm test -- src/overview
npm run test:e2e -- test/admin-users.e2e-spec.ts test/admin-overview.e2e-spec.ts
```
