# Teacher and admin quiz management

All endpoints below require the session cookie established by
[authentication](authentication.md). Students receive 403. Teacher lists contain
only their quizzes; accessing another teacher's quiz by ID returns 404. Admins
can manage all teachers' quizzes, subject to the same grading-consistency rules.
Writes require the configured Origin header.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/classes` | All class IDs/names ordered by name |
| `GET /api/quizzes?page=1&pageSize=20&status=DRAFT` | Paginated quiz summaries; status is optional |
| `GET /api/quizzes/:id` | Full authorized detail, including questions and correct options |
| `POST /api/quizzes` | Create a draft; returns 201 |
| `PATCH /api/quizzes/:id` | Update supplied fields; returns 200 |
| `POST /api/quizzes/:id/publish` | Validate and publish; returns 200; repeated calls are idempotent |
| `DELETE /api/quizzes/:id` | Delete an unused quiz and its child data; returns 204 |

List responses contain `{items,total,page,pageSize}`. Page size is 1–100.
Summaries contain teacher/class identities, questionCount and attemptCount but no
questions or answer keys. Detail responses add ordered questions/options and
maxScore. Decimal values are JSON **strings** to retain precision.

## Creating and editing

Creation requires `title`, `opensAt` and `closesAt`. Defaults: DRAFT, language EN,
durationMinutes 20, negativeMarking NONE, penaltyValue "0", no questions/classes.
Teacher ownership comes from the authenticated user and cannot be forged.
An admin must explicitly supply `teacherId`, identifying a TEACHER account.
Ownership cannot subsequently be transferred through PATCH.

```json
{
  "title": "مراجعة الجبر",
  "description": "اختبار أسبوعي",
  "language": "AR",
  "durationMinutes": 20,
  "opensAt": "2026-09-24T09:00:00+03:00",
  "closesAt": "2026-09-30T18:00:00+03:00",
  "negativeMarking": "FRACTION",
  "penaltyValue": "0.25",
  "classIds": ["replace-with-an-ID-from-GET-classes"],
  "questions": [
    {
      "prompt": "ما ناتج 2 + 2؟",
      "points": "1.5",
      "options": [
        { "text": "3", "isCorrect": false },
        { "text": "4", "isCorrect": true },
        { "text": "5", "isCorrect": false },
        { "text": "6", "isCorrect": false }
      ]
    }
  ]
}
```

Use real class UUIDs and appropriate dates. Timestamps must include a timezone;
closesAt must follow opensAt. The API stores instants; UI display uses Asia/Amman.

- Duration: integer 1–1440 minutes. Language: AR or EN.
- Points: positive decimal strings with at most eight integer/four fractional
  digits. Penalties use the same format; NONE requires zero, FRACTION requires
  0 < value <= 1, FIXED requires a positive value.
- Up to 200 questions and 100 assigned classes per request. A sample has 15
  questions; this is not an enforced quiz length. HTTP body size limits also apply.
- Question prompt and option text are nonempty. Array position determines the
  one-based order. IDs/order are assigned by the server, not accepted from clients.
- Drafts can have zero questions/classes and 0–4 options per question, with at
  most one correct answer. Option texts must be distinct after trimming.
- PATCH leaves omitted fields unchanged. `description: null` clears it; null is
  rejected for other fields. Empty patches and unknown fields are rejected.
- Supplied `questions`/`classIds` arrays replace the entire corresponding
  collection atomically. Question replacement regenerates question/option IDs;
  this is possible only before any attempt exists. Metadata-only edits preserve IDs.
- Status is not writable through POST/PATCH. Use the dedicated publish endpoint.
  Unpublishing, archiving, cloning and ownership transfers are out of scope.

## Publishing and protecting grading

Publication requires at least one assigned class and question, exactly four
options and exactly one correct answer per question, valid points/penalties/time
window, and a closing time that has not passed. A future opening time is allowed.
Edits to an already published quiz must keep it complete.

Once any attempt exists (in progress, submitted or expired), only title and
description may change. Questions, options, points, language, duration, opening/
closing times, negative marking and class assignments are frozen. Deletion is
blocked. Admins cannot bypass these restrictions. Frozen edits/deletion return
409, invalid input returns 400, and inaccessible/missing quiz IDs return 404.

Mutation transactions acquire a PostgreSQL `FOR UPDATE` row lock before reading
the quiz and counting attempts. A regression test holds an attempt insert open,
proves the edit is blocked waiting for that lock, then confirms it returns 409
after the attempt commits. Future student-attempt creation **must use the same
PrismaService.lockQuiz transaction helper before reading quiz state** so an edit
that wins the lock first cannot leave the attempt with stale questions/deadlines.

## Manual check in PowerShell

Start the API as documented in authentication.md, then:

```powershell
$atcBase = 'http://localhost:3000/api'
$atcHeaders = @{ Origin = 'http://localhost:5173' }
Invoke-RestMethod -Method Post -Uri "$atcBase/auth/login" -Headers $atcHeaders -ContentType 'application/json' -Body '{"username":"teacher-math","password":"AtcDemo2026!"}' -SessionVariable atcSession
Invoke-RestMethod "$atcBase/classes" -WebSession $atcSession
Invoke-RestMethod "$atcBase/quizzes" -WebSession $atcSession
$atcDraft = @{ title = 'Manual draft'; opensAt = (Get-Date).ToUniversalTime().ToString('o'); closesAt = (Get-Date).AddDays(1).ToUniversalTime().ToString('o') } | ConvertTo-Json
$atcQuiz = Invoke-RestMethod -Method Post -Uri "$atcBase/quizzes" -Headers $atcHeaders -ContentType 'application/json' -Body $atcDraft -WebSession $atcSession
Invoke-RestMethod "$atcBase/quizzes/$($atcQuiz.id)" -WebSession $atcSession
```

Publishing this empty draft should return 400 until its questions/classes are
supplied. The command creates a real development quiz, not a test fixture.

## Feature tests

```sh
npm run test:e2e -- test/quiz-management.e2e-spec.ts
npm run test:e2e -- test/quiz-publishing.e2e-spec.ts
npm run test:e2e -- test/quiz-authorization.e2e-spec.ts
npm run test:e2e -- test/quiz-validation.e2e-spec.ts
npm run test:e2e -- test/quiz-edit-protection.e2e-spec.ts
```

Tests use isolated schemas and clearly named scenarios. The attempt-protection
tests create database fixtures directly; student start/save/submit and scoring
endpoints are the next implementation stage.
