# Editor Update Report

## Changes
- Added configurable editor last-activity sync: `NEXT_PUBLIC_EDITOR_ACTIVITY_SYNC_MS` (default 60000 ms).
- Activity writes happen only after real editor mutations; idle editors do not write every interval.
- Added `POST /api/roadmaps/:id/activity`, persisting the last-activity timestamp via `roadmaps.updated_at`.
- Added a visible `Last activity HH:MM` indicator in the editor status bar.
- Removed Paragraph, Button, Links Group, Horizontal Line, Vertical Line, and Section from the editor palette.
- Existing saved editor states containing those unsupported blocks are sanitized on load and auto-saved away.
- Added topic hover cards showing topic description, resource links and actions to edit/manage links.
- Added direct `Studio / 1-page` view toggle to the app bar.
- Added direct `Light / Dark` theme toggle to the app bar.

## Verification
- Parsed every TypeScript/TSX source file under `app`, `components`, and `lib`.
- Result: 94 files, 0 parser/syntax errors.
- Verified the new activity API route exists.
- Verified editor palette no longer contains the removed visual block types.
- Verified app-bar view and theme toggles are present.

## Runtime limitation
A full Next.js build/browser E2E run could not be performed in this workspace because the installed working directory does not contain the `next` executable. The source-level verification above is therefore not a substitute for a production browser test.
