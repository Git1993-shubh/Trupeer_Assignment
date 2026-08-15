# Part 2 — Trupeer E2E Automation (Playwright)

Playwright + JavaScript suite for Trupeer login, editor, Rewrite with AI, and Zooms.

## Prerequisites

- Node.js 18+
- A Trupeer account that already has at least one video with a script
- Chromium (installed via Playwright)

## Setup

From the repo root:

```bash
# 1) Environment
cp .env.example .env
# Edit .env with your credentials and video title
```

Required variables in `.env` (repo root):

```text
TRUPEER_BASE_URL=https://app.trupeer.ai
TRUPEER_EMAIL=your-email@example.com
TRUPEER_PASSWORD=your-password
TRUPEER_VIDEO_NAME=simple. Website User Guide
```

Optional:

```text
PLAYWRIGHT_HEADED=true
```

Then:

```bash
cd part2
npm install
npx playwright install chromium
```

## Run

Single command (from `part2/`):

```bash
npx playwright test
```

Headed (visible browser) + Allure report:

```bash
npx playwright test --headed
npm run allure:generate
npm run allure:open
```

**Allure note:** The Allure CLI needs a JDK (Java 17+). If `allure generate` fails with `JAVA_HOME`, install [Microsoft OpenJDK 17](https://learn.microsoft.com/en-us/java/openjdk/download) and ensure `java -version` works in your terminal.

Or:

```bash
npm run test:headed
npm run allure:generate
npm run allure:serve
```

Useful variants:

```bash
npm run test:headed      # visible browser
npm run test:debug       # Playwright inspector
npm run report           # Playwright HTML report
npm run allure:generate  # build Allure HTML from allure-results
npm run allure:open      # open Allure report
npm run allure:serve     # generate + open Allure in one step
```

## What is covered

| Spec | Flow |
|------|------|
| `tests/login.spec.js` | Valid login → dashboard; invalid credentials stay on auth |
| `tests/editor.spec.js` | Open existing video → timeline / preview / script; Rewrite with AI; Zooms panel |
| `tests/negative.spec.js` | Empty AI prompt validation gap; prompt longer than 300 chars |

## Architecture

```text
part2/
├── pages/           # Page Object Model (selectors + actions)
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   └── EditorPage.js
├── tests/           # Specs (assertions only)
├── utils/env.js     # Credentials from environment
└── playwright.config.js
```

## Notes for reviewers

1. **AI control name** — Product UI labels the feature **Rewrite with AI** (magic-wand icon on the Script toolbar). Tests map the assignment’s “Modify Script with AI” to that control.
2. **AI output** — Assertions check that a rewrite completes and script text changes; they do not assert exact AI wording.
3. **Empty prompt bug** — `Rewrite script` stays enabled at `0/300` and submitting an empty prompt closes the dialog without an error. Covered in `negative.spec.js` and documented in `part1/bugs.md`.
4. **Waits** — Tests use Playwright auto-waiting / `waitFor` / `expect.poll` only (no hard-coded sleeps in specs).
5. **Credentials** — Never hardcoded; loaded from `.env` via `utils/env.js`.

## Troubleshooting

- **Login timeout** — Confirm `.env` email/password and that `TRUPEER_BASE_URL` resolves to `https://app.trupeer.ai`.
- **Video not found** — Set `TRUPEER_VIDEO_NAME` to an exact Recent content title (e.g. `simple. Website User Guide`).
- **AI timeout / rate limit** — Free-trial AI minutes may be exhausted; document in Part 1 and re-run when quota resets.
- **Selector drift** — Update only the relevant page object under `pages/`.
