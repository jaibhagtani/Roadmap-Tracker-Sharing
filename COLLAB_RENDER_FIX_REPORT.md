# Collaboration render/polling fix report

## Problem
`/collaborate/[roadmapId]` and its embedded `RoadmapTree` were refreshing far too frequently. The collaboration page polled branches/groups every 3.5s, while the branch roadmap tree polled its branch snapshot every 1.5s. The RoadmapTree polling effect also depended on `syncVersion`, so every detected version change rebuilt the effect and timer.

## Fixes
- Collaboration workspace polling is now configurable through `NEXT_PUBLIC_COLLAB_SYNC_MS` and defaults to 15 seconds (minimum 10 seconds).
- Background collaboration refreshes use silent loads and do not toggle loading UI.
- Concurrent branch/group requests are deduplicated with `AbortController` refs.
- Branch/group state is updated only when the server response signature changes.
- Group form values are not overwritten while the owner is editing them.
- Polling pauses while the browser tab is hidden and resumes on visibility.
- RoadmapTree collaboration polling is now configurable through `NEXT_PUBLIC_COLLAB_BRANCH_SYNC_MS` (falls back to `NEXT_PUBLIC_COLLAB_SYNC_MS`, default 15 seconds).
- RoadmapTree polling no longer depends on `syncVersion`, so the timer is not recreated on each remote version change.
- `syncVersion` is tracked in a ref for polling decisions.
- RoadmapTree polling deduplicates in-flight requests and only updates state when versions/presence/member data actually changed.
- RoadmapTree loads use a ref so polling does not capture a changing function identity.
- SessionSync was checked to confirm it does not call `router.refresh()`.

## Static verification
- Collaboration/roadmap polling fix checks: 16/16 PASS.
- Parser-oriented diagnostics for the two edited TSX files: 0.

## Build limitation
A full `npm ci`/Next.js production build could not be completed in this environment because dependency installation is unavailable. The final package therefore has static/parser validation, but not a production build claim.
