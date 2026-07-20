# calendar-sync

Writes the week plan into an Apple Calendar named "Morning Board", so the plan
reaches the phone through iCloud.

    swift run --package-path scripts/board/calendar-sync calendar-sync

Run it from the repository root: it reads the store credentials from .env.local
in the working directory. Calendar access is granted once, interactively, on the
first run.

The sync owns the "Morning Board" calendar completely and touches no other
calendar. Running it twice changes nothing the second time. An empty read is
treated as an error rather than an instruction to empty the calendar, and so is
a partial one: if any plan day carries a date the tool cannot read, it names the
day and exits without touching the calendar, because a day quietly dropped would
take its existing event down with it.

    swift test --package-path scripts/board/calendar-sync

Design: docs/superpowers/specs/2026-07-20-morning-board-calendar-design.html
