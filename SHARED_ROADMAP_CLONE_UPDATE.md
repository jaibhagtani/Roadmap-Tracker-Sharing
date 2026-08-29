# Shared Roadmap Clone Update

Implemented independent cloning for full roadmap share links.

## Supported sources
- Friends / Link share pages
- Public share pages
- Existing accepted full-roadmap share requests

## Behavior
- Signed-in users see **Clone to my account** on full roadmap share views.
- Anonymous users are sent to login and returned to the share page.
- A clone is always created as a new private roadmap owned by the current user.
- Every topic/layer receives a new database ID.
- Every visual editor element receives a new ID.
- Topic positions, topic colors, and React Flow connection endpoints are remapped to the new IDs.
- Connection IDs are regenerated.
- Resources, goals, and roadmap todos are copied into the new roadmap.
- Personal progress, shares, collaboration membership, branches, and the original roadmap are never reused.
- The original roadmap remains unchanged.

## Endpoint
`POST /api/shared/[slug]/clone`

Only roadmaps with `privacy=public` or `privacy=link` can be cloned through a share slug.

## Existing collaboration
The existing collaboration-request/accept flow is preserved. Cloning creates an independent roadmap and does not grant access to or alter the source roadmap.
