# Editor / 1-Page UI Fix Report

## Editor request loop

The roadmap editor previously recreated its `load` callback because it depended on the React Flow instance returned by `useReactFlow()`. The mount effect depended on `load`, which could therefore retrigger repeatedly and cause many repeated `GET /api/roadmaps/:id` requests.

Fixed by:

- keeping the latest React Flow instance in `rfRef`
- removing the React Flow instance from the `load` callback dependencies
- moving viewport restoration to `requestAnimationFrame`
- deduplicating simultaneous loads with `loadInFlightRef`
- keying in-flight dedupe by roadmap request key

Expected behavior now:

- Initial editor load: one roadmap list request + one roadmap detail request (with normal React development checks guarded by in-flight dedupe)
- Changing roadmap: one list refresh + one selected roadmap detail request
- Every 3-minute global sync: one refresh when the editor is clean
- Save/topic/resource mutations do not create a reload loop

## 1-page UI

The 1-page workspace is now a fixed-height dashboard-style view matching the supplied reference composition:

- dark reference-style application bar
- compact roadmap editor at the top
- component palette on the left
- roadmap canvas in the center
- inspector on the right
- compact calendar + task list in the lower-left
- architecture overview in the lower-middle
- friends/sharing in the lower-right
- responsive fallback below desktop width

The 1-page option remains available from the app-bar Add menu at `/roadmap?view=one-page`.

## Static validation

- 97 TypeScript / TSX source files parsed successfully with TypeScript 5.8.3.
- 0 syntax/parse errors.
- Full `npm ci` / production build could not be completed in this environment because the dependency install did not finish; `node_modules` was left without the required binaries.
