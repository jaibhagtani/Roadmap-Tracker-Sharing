# Roadmap Editor Runtime Fix

Fixed `components/roadmap-editor.tsx` crash:

`Cannot read properties of undefined (reading '0')`

## Cause
The roadmap editor assumed the API/local draft always contained a valid `topics` array. Shared/older/partially migrated roadmap data could arrive without `topics`, causing selection initialization to access `baseRoadmap.topics[0]`.

## Fix
- Normalize API roadmap topics to `[]` when missing or malformed.
- Normalize local draft topics to `[]`.
- Build `baseTopics` as a guaranteed array.
- Pass `baseTopics` into `applyDefaults`.
- Use `baseTopics` for selection validation and initial selection.
- Store the normalized topics array in editor state.

Empty roadmaps now load normally, with no selected topic, and the editor can continue creating topics.
