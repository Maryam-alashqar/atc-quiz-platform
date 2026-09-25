# AI usage

I used AI coding agents for most of the implementation. I set the scope, made the product decisions, split the work into stages, and reviewed and tested each stage before merging it. This file explains who did what and how the output was checked, including where the tools got things wrong.

## Tools

| Tool | Used for |
| --- | --- |
| **OpenAI Codex** | The backend: Prisma schema and migration, CSV importer and seed, cookie/JWT authentication and role guards, quiz management and publishing rules, timed attempts and scoring, results and CSV export, with their tests and `backend/docs/`. |
| **Claude Code** (Claude Opus) | Reviewing the brief and my scope document, an independent check of the Codex backend, the whole React frontend, the admin features (account management, dashboard), per-account login rate limiting, Docker Compose, and the final documentation. |
| **Prisma agent skills** | Prisma's official reference skills (`prisma/skills`, see `backend/skills-lock.json`), installed while setting up Prisma. The installer writes a copy for each supported agent, which is why `backend/.agents/`, `backend/.claude/skills/` and `backend/.windsurf/` exist. Windsurf itself was not used. |

## How I directed the work

1. **Scope first, code second.** I turned Nour's brief into a written requirements and scope document before any feature code. I asked Claude Code to review it. It proposed a few changes, and I accepted them into the scope:
   - negative marking as a *fraction of each question's points*, because questions carry different points
   - an Admin role for Nour
   - username instead of email login
   - saving every answer immediately
   - seeding through the same importer that real spreadsheets will use

   The result is [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). For the tests, I asked for scenario names that read as behaviour ("rejects a second attempt …"), so the test report doubles as a checklist.
2. **Backend before frontend, one stage per branch.** I gave Codex the agreed scope document and had it implement the backend stages in order: schema, import, auth, quizzes, attempts, results. Each stage was built on its own `feat/...` branch. I reviewed it and ran its tests, then merged it with `--no-ff`, so the history shows each step.
3. **Independent check before building on it.** Before starting the frontend, I had Claude Code run every backend test suite and walk through the API as a student, teacher and admin. It also tried abuse cases: another class's quiz, a cross-question option ID, a forged score, a second start, another teacher's quiz. All were rejected correctly.
4. **A design to aim at, not a spec to copy.** I supplied a dashboard mock-up. I told Claude Code to follow the look, but not to fake anything the data can't support. It removed rank, search, notifications and the extra menu items instead of hard-coding numbers, and noted this in DECISIONS.md.
5. **Testing it myself as a user.** I clicked through each stage in the browser and reported problems back (see below). Some features came from that testing. Account management and the admin dashboard were my requests: with no sign-up and ready-made accounts, the admin needs a way to add students and teachers, and the admin home should match the design.
6. **I made the product decisions.** When there was a real choice, the agent asked and I chose:
   - no forced password change on first login
   - no account deactivation for now
   - how the admin's quiz ownership works
   - when to push and merge

## Where the AI got it wrong, and how it was caught

| Problem | Caught by | Fix |
| --- | --- | --- |
| The **sign-out button did nothing** visible. The code cleared the whole query cache, including the session query the page was watching. The agent's own browser check had reloaded the page, which hid the bug. | Me, testing in the browser | The session is now updated in place, plus a regression test that watches the session during sign-out. |
| **Adding a teacher** only worked from the Teachers tab, and the button said "Add student" everywhere else. | Me | One "Add user" button, with a Student/Teacher choice in the form. |
| Converting a penalty of "33.33%" to the API's fraction gave `33.33` instead of `0.3333`. | The agent's unit test, before commit | Rewrote the conversion; the test is kept. |
| Login was limited **per IP address**, 10 per minute. A whole class on the centre's Wi-Fi shares one public IP and would be locked out when a quiz starts. | Claude Code, while putting the API behind nginx | Limit per IP *and* username. The proxy is trusted only inside Docker. Two new tests. |
| **`docker compose up` failed on a clean machine.** The lock files came from npm 11, and the Node 22 image ships npm 10. | Building from an empty Docker volume, as a reviewer would | npm 11 pinned in both images. |
| The student dashboard was **wider than a phone screen**: grid items defaulted to their content width. | Screenshots at 390px | `min-w-0` on cards. |
| A first draft of DECISIONS.md said the admin dashboard grades expired attempts. It doesn't. | Checking the text against the code | Corrected. |
| An unclear error when the import folder path was wrong. | Testing the documented import command in Docker | The CLI now names the missing file. |

## How the output was checked

- **Automated tests**, run after every stage:
  - Backend: 71 unit tests, 170 end-to-end API tests against real PostgreSQL (each file in its own throwaway schema), and 4 database tests for the importer.
  - Frontend: 44 unit tests.
  - The most important checks are in the backend e2e suite: one attempt per student including concurrent starts, deadlines and the grace period, scoring with and without negative marking, answer keys never sent to students, and teacher ownership.
- **Typecheck and lint** on both apps before each commit.
- **Real browser runs.** Claude Code drove Microsoft Edge (headless, via puppeteer) with scripts that:
  - sign in as each role
  - take a quiz and reload the page mid-quiz, to confirm the timer and answers survive
  - let a one-minute quiz run out, to confirm auto-submit and the score
  - create quizzes and accounts
  - sign out

  It took screenshots at phone (390px) and desktop (1280px) widths in both Arabic and English, and checked them for layout problems.
- **Manual review.** I tried each stage myself before merging.
- **A clean Docker run.** From an empty volume: build, migrate, seed, take a quiz through nginx, restart (data kept), and import a CSV folder.

## Configuration committed for the agents

- [CLAUDE.md](CLAUDE.md): project conventions for Claude Code (stack, commands, rules such as "scoring only on the server" and "every UI string in both dictionaries").
- `backend/skills-lock.json` and the skill folders: the Prisma reference skills described above.

## Limits

- The sample questions and Arabic names were generated. They are realistic demo content, not reviewed curriculum.
- The browser scripts used for checking were not committed as automated tests. Turning them into Playwright tests in CI is on the next-week list in DECISIONS.md.
