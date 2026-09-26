# Understand the project before reading every line

## Four responsibilities

| Layer | Entry point | Responsibility |
| --- | --- | --- |
| Browser | client/src/main.jsx | Mount React; display data and collect input. |
| HTTP backend | server/src/index.js | Connect MongoDB and start Express. |
| Database | server/src/models.js | Persist neighborhood state and login sessions. |
| Optimization service | scheduler/main.py | Validate a scheduling request, solve or check it. |

React never connects directly to MongoDB. The browser never gets the scheduler's secret. Express selects the logged-in user's neighborhood and sends only that neighborhood's scheduling data to Python.

## Follow one Generate click

1. Schedule.jsx invokes `mutate('/plans/.../generate', 'POST')`.
2. App.jsx adds the neighborhood's current revision to the request and marks the page busy.
3. api.js serializes the body as JSON; the browser sends its HttpOnly session cookie automatically.
4. app.js checks the Origin, session, manager role and revision. It loads the draft.
5. domain.js expands weekly availability into dated UTC-minute intervals, includes exceptions, computes historical night workload and neighboring published commitments.
6. Express sends that problem to `/solve` with its private service key.
7. models.py validates the structured payload. engine.py creates one Boolean decision variable per DA/shift pair.
8. Constraints eliminate invalid combinations. The first optimization minimizes missing staffed minutes. The second preserves that achieved coverage while improving soft targets and preferences.
9. The engine independently validates its result and produces assignment IDs plus gap reasons.
10. Express checks the result again and saves with a revision condition. If another request changed the neighborhood during solving, the save fails rather than overwriting that change.
11. React receives the updated state and renders the assignment rows. Publication is a separate manager action.

## Key JavaScript concepts in this project

`const` gives a binding a value. Objects group named fields. Arrays hold lists. `.map()` transforms lists; `.filter()` selects members; `.find()` selects one; `.reduce()` accumulates a total. `async` functions return promises; `await` pauses that function until an operation settles. Destructuring pulls fields out of objects. `...object` copies fields. Template literals interpolate values into strings. `?.` safely reads an optional object. `??` or `||` supplies a fallback (with different handling of falsy values).

React `useState` holds component state. Calling its setter schedules a new render. `useEffect` loads initial data after mounting. JSX describes elements. `{...}` inside JSX evaluates JavaScript; `onClick`/`onChange` pass event handlers. A controlled input takes its displayed value from state and updates it through an event handler. `key` tells React whether a repeated child is the same component; revision-based keys intentionally reset assignment forms after a successful save.

Express middleware executes in order. Authentication runs before protected routes; manager middleware protects manager routes. Validation failures become JSON errors. MongoDB's conditional update on `revision` provides optimistic concurrency control within one neighborhood document.

## Optimization without machine learning

Let x[e,s] equal 1 if employee e receives shift s, and 0 otherwise. For every shift:

`sum(x[e,s]) + missing[s] = required[s]`

An unavailable employee has x[e,s] = 0. Weekly assigned minutes cannot exceed the maximum. Overlapping intervals cannot both be selected. A short apparent gap is permitted only when other selected intervals completely bridge it into one continuous period. Rolling occupied-minute constraints prevent any such continuous run exceeding the maximum. Locked shifts fix the relevant variables to their saved values.

First objective: minimize `sum(missing[s] * duration[s])`. This measures uncovered **staff-minutes**, not simply the count of empty blocks. Solver phase one has a ten-second limit. Phase two fixes its achieved coverage and spends up to ten more seconds improving preferences. If phase one timed out with a feasible solution, best coverage is not proven; the API reports that distinction.

Soft terms: shortfall from target hours, preference for volunteers on night shifts, recent four-week nonvolunteer night burden, and a squared count penalty that discourages concentrating this week's night blocks on one nonvolunteer. These are transparent heuristic weights, not a claim of mathematically perfect fairness. Shift blocks containing even some night time count as night blocks, and their full duration contributes to the history metric.

## Database design and trade-offs

One Workspace holds name, config, members, plans and revision. One Session holds a hash of a random token, workspace ID, member ID and expiry. Password hashes never leave the backend. Sessions expire after eight hours; the API checks expiry even before MongoDB's TTL cleanup runs.

The aggregate document allows a single atomic schedule update and simple neighborhood isolation. It is intentionally bounded for a pilot. MongoDB has document size limits; a large long-running service should separate employees, plans and audit events into collections and use appropriate transactions/indexes. This prototype keeps all plans and does not implement archiving. Cross-neighborhood staff would also require a different ownership model.

## Security boundaries implemented

Manager roles are set by the seed script; the DA creation route never accepts a role. Cookie tokens are random and stored hashed server-side. Passwords use bcrypt. Browser writes require the configured Origin and JSON request body. Helmet supplies security headers. Login has rate limiting. Returned state removes hashes and hides other DAs' availability/email from DA viewers. Local CSV export prefixes formula-like cell content. Production uses Secure cookies, which require HTTPS.

This does not implement campus SSO, account recovery, email delivery, tamper-evident auditing or production monitoring. An authorized manager can view staff availability in their neighborhood, as required for scheduling. Do not put real employee information in public demo data.

## Read in this order

1. client/src/main.jsx, api.js and time.js.
2. App.jsx; follow state, login and mutate.
3. Availability.jsx, Settings.jsx, Schedule.jsx.
4. server/src/index.js, models.js, contracts.js.
5. server/src/app.js and domain.js.
6. scheduler/models.py, main.py and engine.py.
7. Tests. Read each named scenario, inputs and assertion.

Open LINE_BY_LINE.html locally for the annotated source reader. README and these guides explain the surrounding design; the reader keeps source line numbers attached to the exact code.
