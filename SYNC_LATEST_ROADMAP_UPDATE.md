# Sync Latest Roadmap Update

Added a reusable `SyncRoadmapButton` to roadmap experiences so users can explicitly load the latest server version.

## Coverage
- Create/Edit Roadmap studio
- Read-only live roadmap
- Shared roadmap view
- Collaboration roadmap workspace
- Team/community roadmap panels using `RoadmapTree`
- Public roadmap share
- Shared topic roadmap

## Behavior
- Authenticated roadmap sync uses `/api/roadmaps/:id?sync=1` to bypass the short-lived user cache.
- Shared/private collaborator sync uses the no-store access endpoint.
- Branch sync reloads the current branch snapshot.
- Public share sync uses `/api/shared/:slug?sync=1`.
- Topic-share sync uses `/api/shared/topic/:token?sync=1` and preserves the canonical editor state for accurate canvas positioning/colors/elements.
- Editor sync warns before replacing unsaved local changes and removes the recovered local draft after a successful sync.
- The button shows `Sync latest`, `Syncing…`, and `Synced` states and uses the shared shadcn-style Button component.
