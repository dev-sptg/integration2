# Leo Playground E2E Tests

Playwright test suite for validating Leo Playground examples on both staging and production environments.

## Scope

This subproject covers:
- Playground load and smoke checks
- Example flows (`auction`, `token`, `vote`, etc.)
- Terminal execution checks via `waitForTerminalExecution`

Test sources are in `tests/leo-playground/tests/`.

## Project Structure

```text
tests/leo-playground/
├── package.json
├── playwright.config.ts
├── tests/
│   ├── common.ts
│   ├── playgroundStart.spec.ts
│   ├── test-*-example.spec.ts
│   ├── helpers/
│   ├── POM/
│   └── test-data/
├── playwright-report/
└── test-results/
```

## Prerequisites

- Node.js 20+
- Yarn

## Install

```bash
cd tests/leo-playground
yarn install --frozen-lockfile
```

## Run Tests

From `tests/leo-playground`:

```bash
# staging
TEST_MODE=staging yarn playwright test

# production
TEST_MODE=production yarn playwright test
```

Or via scripts:

```bash
yarn test:staging
yarn test:production
```

## Configuration

Key config is in `tests/leo-playground/playwright.config.ts`:
- `testDir: ./tests`
- `baseURL` switches by `TEST_MODE`
  - `production` → `https://play.leo-lang.org`
  - default/staging → `https://stage-pg.leo-lang.org`
- `reporter: html`
- CI defaults: `workers: 1`, `retries: 2`

Helper-specific env vars (`tests/leo-playground/tests/common.ts`):
- `PLAYWRIGHT_TERMINAL_TIMEOUT_MS` (default `20000`)

## Reports

After a run:
- `tests/leo-playground/playwright-report/` — HTML report
- `tests/leo-playground/test-results/` — Playwright result artifacts (screenshots/traces when enabled)

Open report locally:

```bash
cd tests/leo-playground
yarn playwright show-report
```

## CI Workflow

GitHub Actions workflow: `.github/workflows/leo-playground-test.yml`

Current behavior:
- Runs in `tests/leo-playground`
- `staging`: `--retries=0 --trace=off`
- `production`: default retries from config
- Uploads artifacts:
  - `playwright-report-staging`
  - `playwright-report-production`

## Troubleshooting

### Staging is much slower than production
Common reasons:
- More failing cases on staging
- Retry policy (if enabled)
- Trace collection on retries

Mitigations already used in CI staging job:
- Disable retries (`--retries=0`)
- Disable traces (`--trace=off`)

### Terminal waits too long
`waitForTerminalExecution` polls terminal output and waits for compile result.
If needed, increase timeout:

```bash
cd tests/leo-playground
PLAYWRIGHT_TERMINAL_TIMEOUT_MS=30000 yarn test:staging
```
