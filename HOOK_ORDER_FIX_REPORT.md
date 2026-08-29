# Hook Order Fix Report

## Root cause
`StudioInner` returned early while `loading` or when `roadmap` was null, but declared `selectAndFocus` with `useCallback` after those returns. This meant the hook was skipped on one render and present on another, violating React's Rules of Hooks.

## Fix
Moved `selectAndFocus` above all conditional returns so it is invoked on every render in the same order.

## Validation
- Parsed all TS/TSX files with TypeScript parser: 0 parse errors.
- Confirmed `selectAndFocus` is declared exactly once and before the conditional returns in `components/roadmap-editor.tsx`.
- Full `tsc --noEmit` was not run because this source archive has no installed `node_modules`.
