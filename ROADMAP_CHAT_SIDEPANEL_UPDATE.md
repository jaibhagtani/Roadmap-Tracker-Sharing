# Roadmap Chat Side Panel Update

- Reused the existing `GroupChat` component and `/api/collab/[roadmapId]/messages` backend.
- Added a `Roadmap Chat` button to the roadmap editor header.
- Chat opens as a professional right-side drawer without changing the canonical roadmap canvas layout.
- Messages are loaded and sent through the existing authenticated collaboration-message endpoint.
- Access follows the same `getRoadmapRole` permission layer used by the rest of the roadmap collaboration system.
- Existing team/community split-pane chat remains unchanged.
