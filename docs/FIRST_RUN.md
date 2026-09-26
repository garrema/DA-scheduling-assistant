# First working schedule in about ten steps

Use synthetic accounts while learning. All times in the UI are neighborhood time, initially America/New_York—even if your laptop is in India.

1. Log in as the seeded manager. Open **Rules**.
2. For a small demonstration, remove the default operating windows and add **Monday 08:00–12:00**. Keep the 20-hour cap, 10-hour target, six-hour continuous limit; set the rest gap your manager confirms. Save.
3. Open **Team**, create two DAs with distinct emails and initial passwords of 12+ characters. The app does not email those passwords.
4. Sign out. Sign in as the first DA. Open **Availability**, add Monday 08:00–12:00, and save. Optionally change the initial password in Account.
5. Repeat for the second DA. For a night demonstration, instead use overnight operating hours and matching availability split at midnight.
6. Log in as manager. Choose a Monday in **Schedule**. Dates are normalized to Monday.
7. Use **Create blocks for all operating hours** with one DA required. This creates two two-hour coverage blocks. You may instead add one four-hour block manually. Do not do both because blocks cannot overlap.
8. Click **Generate schedule**. A solution can assign adjacent blocks to one person or distribute them. Ten hours is a target, so a person getting fewer hours is allowed. With only four required hours, both people cannot receive ten.
9. Review names/hours. Edit checked names and **Save** on each changed row. Save a lock to preserve that exact block's assignments during regeneration. Invalid edits are rejected without saving. Locking an empty block intentionally keeps it empty, so use carefully.
10. Click **Publish**. Sign in as a DA to see the published week. Use **Export CSV** for a local copy. Export is not a When I Work upload integration.

## Test a shortage

Create another operating period nobody is available for. Generate. The app leaves the block unfilled and shows reasons rather than overriding availability. Publish is blocked until all requirements are covered or the manager legitimately corrects the coverage configuration.

## Night preference

Availability grants permission to schedule a time; preference guides which eligible person gets it. Checking “I prefer night shifts” does not expand availability or bypass rest/hour limits.

## Operating blocks and work periods

A DA assigned 08:00–10:00, 10:00–12:00 and 12:00–14:00 works one six-hour continuous period. Assigning 14:00–16:00 as well is invalid. A break shorter than the configured minimum rest is also invalid, unless the gap is fully covered by adjacent assigned blocks and the total continuous span is still at most six hours.

## What to measure in the pilot

Record actual manager time from starting the schedule to approving it; include edits and corrections. Compare multiple comparable weeks, staffing coverage and manager changes. Do not claim percentage savings until measured. Use actual adoption scope on the resume (one manager or neighborhood if that is the real scope).
