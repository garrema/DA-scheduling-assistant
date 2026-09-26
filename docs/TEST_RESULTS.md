# Verification report

Checked on 25 September 2026. This report describes what actually ran, not future CI results.

| Check | Result |
| --- | --- |
| Python / OR-Tools scheduling suite | 18 tests passed |
| Express API lifecycle and time/coverage helpers | 8 tests passed |
| React interaction tests under jsdom | 3 tests passed |
| Vite production build | Passed |
| npm production dependency audit | 0 reported vulnerabilities at check time |

## Scheduling tests

Availability, date exceptions, soft ten-hour target, maximum twenty hours, rest after a night shift, adjacent 2+2+2-hour blocks, rejection of an eight-hour chain, overlap, neighboring-week rest, cross-week continuous work, invalid locks, night preference, historical night burden, within-week night balancing, empty workforce, unknown/duplicate assignments and private service authorization.

## API and domain tests

Login and logout, unauthenticated rejection, Origin enforcement, role restrictions, password-hash filtering, DA privacy, availability save, stale-revision rejection, draft visibility, schedule generation, publication and reopening. Domain tests cover Monday boundaries, daylight-saving availability, closing hours, uncovered operating periods, cross-week commitments and block generation (including DST).

The API lifecycle test ran against the **real Python scheduler with a test-only in-memory repository double**. A real disposable MongoDB process could not start here (`open: Operation not permitted`). Consequently, live MongoDB connectivity, persistence, indexes and TTL cleanup were **not verified in this environment**. The default `npm test` uses a real disposable MongoDB process on your machine/CI; the explicit `IN_MEMORY_TEST=1` option uses the double. No fallback database exists in the normal app.

## UI tests

React tests exercised manager login, DA availability/night preference submission, role-specific navigation and stale-save error/refresh handling. These used a DOM simulator and mocked HTTP responses. The React build compiled successfully.

A real Chromium browser run could not be completed because its browser download failed. Visual layout, browser-specific behavior and end-to-end browser interaction are therefore **not claimed as verified**. Docker was not available, so the included Docker setup was not executed here.

## Known test warning

FastAPI's test client emits a deprecation warning about its httpx transport. All solver tests still pass. This concerns test tooling, not the app's Express-to-FastAPI HTTP calls.

## Required local pilot check

Run the Windows setup, default database-backed API tests, and FIRST_RUN.md on your machine. Use synthetic accounts first. Confirm the real manager's rules before publishing actual staff schedules. No college deployment, institutional integration, real user adoption or measured time savings is claimed by this project.
