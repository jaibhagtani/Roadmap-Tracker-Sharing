# Group Collaboration Functionality Report

## Implemented
- Teams/communities are attached to a roadmap and share one canonical roadmap identity.
- Non-viewer members get direct edit access to the main roadmap when `directCollaboration` is enabled (default true).
- No branch/commit/leader approval is required for normal group contributions.
- Existing branch/commit workflow remains available for non-group collaboration and can still be used when desired.
- Any current group member can invite users.
- Join-request review can be performed by any current group member.
- Join requests and approvals respect the configured member limit with row locking.
- Open/request/invite access modes are preserved.
- A persistent invite token and dedicated invite-link route were added.
- Joining via the invite link immediately grants group membership and roadmap editor access.
- Group chat is available to members from the same collaboration workspace and polls every 15 seconds only while the tab is visible.
- Chat messages no longer increment the roadmap version, so chat activity does not cause roadmap reloads.

## Validation
- 110 TS/TSX files parsed with 0 parser errors.
- 0 unresolved local `@/...` imports.
- Targeted group/invite/chat/direct-edit checks: 10/10 passed.
- Full dependency-backed Next.js build was not run because this working tree has no installed `node_modules`/lockfile in the execution environment.
