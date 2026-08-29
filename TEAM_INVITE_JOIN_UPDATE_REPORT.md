# Team/Community Invite & Join Approval Update

Implemented:
- Any current team/community member can invite users directly.
- A user can submit a join request when the group's access mode permits requests.
- Pending join requests are visible to the owner and all current members.
- Any current member can accept or reject a pending join request.
- Join-request notifications are sent to all current members, not only the owner.
- Existing capacity locking is preserved to prevent exceeding the configured member limit during concurrent approvals.
- Owner-only controls remain owner-only: team/community settings, role changes, member removal, and capacity configuration.
- Direct invite grants the selected roadmap role immediately and sends the invite notification.

Validation:
- TypeScript/TSX transpilation checks passed for all modified files.
- No merge-conflict markers in modified files.
- Existing database schema is sufficient; no schema migration was required for this change.

Note: Full dependency installation/build was not run because this working environment does not have the project's runtime dependencies installed.
