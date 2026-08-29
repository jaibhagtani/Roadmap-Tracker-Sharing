# Editor Runtime / Child Layout Fix

## Fixed runtime error
`TopicInspector` now destructures the `onCreateShareLink` callback that it already receives from `StudioInner`. This removes the `ReferenceError: onCreateShareLink is not defined` when the selected topic inspector renders.

## Fixed child placement
New child topics no longer reuse the parent's exact canvas position or stack every new child on one location.

Placement now:
- determines the current sibling index;
- places children in a dedicated column to the right of the parent;
- tries vertically separated candidate positions;
- checks existing topic positions before choosing a slot;
- keeps top-level topics separated as well.

The server-side topic `position` remains the sibling order, while the editor canvas position is maintained independently in `editorState.topicPositions`.

## Validation
- 120 TS/TSX files scanned with TypeScript parser: 0 syntax/parse diagnostics.
- Targeted `onCreateShareLink` wiring check: passed.
- Targeted child-positioning checks: passed.
- Full typecheck was not available because the archive does not contain installed project dependencies (`next`, `react`, Prisma client, etc.).
