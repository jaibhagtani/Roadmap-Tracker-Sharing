# Sharing & Collaboration Access Model

## Friends / Link
- `privacy=link` creates a shareable roadmap link.
- The link is viewable without making the roadmap public in discovery.
- Authenticated recipients can use **Request to collaborate**.
- Accepted roadmap shares can edit according to their granted role.
- Existing `RoadmapShare` and `TopicShare` permissions continue to work.

## Public
- `privacy=public` is explicitly **view-only through the public share link**.
- The public share page does not show a collaboration-request action.
- `/api/collab/:roadmapId/join` rejects direct collaboration requests for public roadmap links.
- Existing roadmap/topic share records on a public roadmap are downgraded to viewer behavior by the access layer, so an old contributor/editor grant cannot bypass public view-only sharing.
- Approved members of a community/team group can still collaborate through the existing group membership flow; this does not turn the public share URL into an editable link.

## Link routing
- Create/Edit Roadmap uses `/share/:shareSlug` for Friends / Link and Public sharing.
- Public share pages do not link anonymous users to authenticated-only `/roadmap/:id/live` routes.
- Private roadmaps continue to use authenticated live/editor routes.

## Existing collaboration requests
The existing collaboration request, notification, accept/reject, community request, member limit, invite, branch and commit flows remain in place. This update only tightens the access boundary between share visibility and collaboration permissions.
