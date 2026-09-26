# Deskwise — DA Scheduling Assistant

A full-stack, manager-reviewed scheduling prototype for university desk assistants.
React + Tailwind · Express + Node.js · MongoDB · FastAPI + Python · Google OR-Tools.

**Start here:** [Windows setup](docs/SETUP_WINDOWS.md) → [first-use tutorial](docs/FIRST_RUN.md) → [architecture and concepts](docs/ARCHITECTURE.md) → [line-by-line code reader](docs/LINE_BY_LINE.html).

## What is implemented

- Manager-created DA accounts; hashed passwords, expiring HttpOnly cookie sessions, role checks.
- Weekly availability, date-specific unavailability, and preference for night shifts.
- Neighborhood operating hours, required staff per block, configurable rules.
- Automatic creation of coverage blocks for an empty week; manual blocks and CSV export.
- OR-Tools draft generation with availability, no overlaps, maximum 20 weekly hours, maximum six continuous hours, and configurable rest between work periods.
- Ten-hour weekly **target**, not a hard minimum. Maximum and target can be reduced.
- Coverage-first objective; night preferences, recent night history, and soft balancing afterwards.
- Manager assignment edits, locks, regeneration, publication and reopening.
- Warnings explaining uncovered blocks. Publication requires all operating hours to have blocks and every block to be fully staffed.
- Independent validation before saving assignments or publishing; cross-week published shifts affect rest and continuous work.
- Separate neighborhood data, optimistic revision checks, timezone-aware times, and a responsive interface.


Each user belongs to exactly one neighborhood. A manager sees that neighborhood only. Seed additional neighborhoods with different manager emails. Cross-neighborhood employment and a central multi-neighborhood dashboard need a shared employee model before implementation.

Defaults: America/New_York; Monday–Sunday local calendar week; 10-hour target; 20-hour maximum; six continuous hours; **eight-hour rest is a configurable example, not a confirmed campus rule**. Night means any overlap with 22:00–06:00. Allowed elapsed lengths default to 2, 4, 6 hours. Managers confirm these settings.

Availability repeats every week; exceptions override it. Updates cannot invalidate future published shifts. Drafts must be regenerated after relevant changes. A draft is hidden from DAs. Reopening a published week hides it until republished; do not use that workflow during active shifts without coordinating with your team.

The optimizer assigns the manager's coverage blocks; it does not search every possible shift boundary. Adjacent blocks can form one work period, up to six hours. Required staffing is attached to each block; blocks cannot overlap. The automatic block tool prefers two-hour blocks when allowed. A 24/7 ordinary week produces 84 blocks. Limits: 150 DAs, 100 blocks per week, 10 DAs per block.

DST weeks can have 167/169 hours. Use appropriate allowed durations (including one hour when necessary) or manually configured coverage; ambiguous/nonexistent local entry times are rejected by the browser. Weekly limits are elapsed hours. Shifts cannot span the Monday boundary; split them. Rest is still checked across that boundary. Imported neighboring weeks must be published to participate in checks.

