# Roadmap Sync Runtime Fix

Fixed `ReferenceError: onSync is not defined` in `components/roadmap-editor.tsx`.

`RoadmapHeader` already declared `onSync` in its TypeScript prop type and the parent already passed `onSync={syncLatest}`, but the destructured function parameters omitted `onSync`. The component now destructures `onSync`, so `SyncRoadmapButton onSync={onSync}` receives the existing sync handler correctly.
