# Community Activity Update

- Community Activity keeps the existing left-side Group/Community Chat.
- The right side is a view-only canonical roadmap canvas; it does not expose the roadmap editor/inspector.
- The existing Full editor button remains the explicit route for editing.
- Community owners see Change limit and Invite controls in the workspace header (and mobile controls).
- Change limit uses the existing owner-only PATCH `/api/collab/[roadmapId]/group` endpoint.
- Community invites use the existing group invite endpoint and create membership + roadmap access + notification.
- Backend now enforces that only the community roadmap owner can invite members to a community; team invitation behavior remains unchanged.
