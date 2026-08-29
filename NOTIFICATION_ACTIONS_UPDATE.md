# Notification Actions Update

Actionable request notifications now expose **Approve** and **Reject** in both the full Notifications page and the app-bar notification popover.

Covered request types:
- Team/community join requests (`collab_group_join_request`)
- Roadmap collaboration requests (`collab_join_request`)
- Direct roadmap/topic/template share requests (`share_request`)
- Collaboration commit review requests (`collab_commit_pushed`): Approve performs the existing merge flow; Reject performs the existing reject flow.

All actions are server-authorized. The server verifies that the signed-in user is the correct owner/member/recipient before changing state. The original request is marked handled and the requester receives a result notification. Duplicate or already-handled actions are rejected safely.

The notification model now stores `collabCommitId` so commit actions never depend on parsing notification text.
