# Direct Private Sharing Update

- Removed password-based roadmap sharing from the application flow.
- Private roadmaps are now **Invite only**.
- Owners can use **Share with person** from the roadmap header and enter either an existing Roadmap user's email or User ID.
- Direct sharing creates/updates a `RoadmapShare` record and sends the recipient a notification containing the authenticated roadmap link.
- Private shared links require the signed-in account to have an explicit roadmap share; there is no password prompt.
- Friends / Link remains collaboration-enabled and continues to use the existing collaboration-request flow.
- Public remains view-only and direct shares are forced to viewer role.
- Public/Friends clone behavior is unchanged.
- The legacy `share_password_hash` database column is removed by migration `20260826143000_remove_private_share_password`.
