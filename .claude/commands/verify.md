---
description: Run the full repository gate and report only what failed
argument-hint: "[extra] e.g. typeperf"
---

Run `pnpm verify`. If dependencies or the lockfile changed in this session, run
`pnpm install --frozen-lockfile` first.

If the argument `typeperf` was given, also run `pnpm typeperf`.

Report the outcome first in one sentence. For each failing command, quote the shortest decisive
line of its output and name the file and line it points at. Do not paste passing output. Do not
fix anything unless asked — the deliverable is the assessment.

$ARGUMENTS
