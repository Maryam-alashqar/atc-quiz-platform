# Database foundation

From the repository root, start PostgreSQL with `docker compose up -d postgres`.
From `backend`, copy `.env.example` to `.env` if it does not exist, then run:

```sh
npm ci
npm run db:deploy
npm run db:generate
npm run db:status
```

Use `npm.cmd` instead of `npm` in PowerShell if script execution is disabled.
For subsequent schema changes use `npm run db:migrate -- --name describe_change`.
Commit the generated SQL migrations. Do not use `db push` instead of migrations:
the migration contains additional PostgreSQL CHECK constraints.

The schema covers users, classes, quiz ownership and class assignments, ordered
questions/options, attempts and saved answers. CSV import and demo seeding are
available; see [data/README.md](data/README.md) for commands, formats and demo
credentials. The Nest Prisma service and cookie authentication are implemented;
quiz/attempt API rules are subsequent steps. See
[authentication.md](../docs/authentication.md) for authentication setup.

Run the database constraint regression checks from the repository root:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Get-Content -Raw -Encoding UTF8 backend/prisma/tests/constraints.sql | docker compose exec -T postgres psql -X -U atc_user -d atc_quiz -v ON_ERROR_STOP=1
```

Or from a POSIX shell:

```sh
docker compose exec -T postgres psql -X -U atc_user -d atc_quiz -v ON_ERROR_STOP=1 < backend/prisma/tests/constraints.sql
```

The checks create temporary fixtures in a transaction and roll everything back.
Any assertion failure exits psql unsuccessfully. They do not reset the database.

## Database guarantees

- One class per student; teachers/admins have no student class. Usernames and
  class names are unique (case-sensitive); normalize usernames in the importer/API.
- A quiz can be assigned to multiple classes. One attempt per student and quiz,
  including competing inserts; one saved answer per attempt and question.
- Composite foreign keys ensure the selected option belongs to the question and
  the question belongs to the attempt's quiz. An unanswered question has no Answer
  row; clearing a selection deletes its row.
- Questions use positive, unique positions per quiz. Options use unique positions
  1–4 per question. Drafts may be incomplete; exactly four options and one correct
  answer must be checked by the publish service.
- Positive duration and points, ordered availability/deadline timestamps, valid
  penalty modes/values, and consistent attempt completion fields are checked in SQL.
- Question points and penalties use Decimal(12,4). Scores use Decimal(20,8) to
  retain the precision of multiplying two four-decimal values. Scoring must use
  decimal arithmetic in the service, floor totals at zero, and round only for display.
- Timestamps use PostgreSQL timestamptz(3), preserving instants; the UI displays
  them in Asia/Amman. Send ISO 8601 timestamps with an explicit offset to the API.
- Deleting a quiz with attempts is restricted. Questions/options cascade when an
  unused quiz is deleted; recorded answers protect their referenced questions/options.

## Rules for the service layer

The database does not enforce teacher/student roles across foreign keys,
authorization, class eligibility, publication completeness, published-content
immutability, or deadline processing. Implement these in the relevant services.
Quiz editing/publishing and attempt creation must coordinate transactionally to
prevent a concurrent edit from changing an attempt's grading basis. Answer saves
and submission must likewise serialize against the same attempt.

Snapshot maxScore when starting an attempt. Compute deadlineAt as the earlier of
the duration deadline and quiz closesAt. Expiry is finalized on the first relevant
read/write (including teacher results); no scheduler is required. Define the
10-second grace policy in the attempt service and test its exact boundary.
