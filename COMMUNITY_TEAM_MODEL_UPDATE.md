# Community / Team Model Update

## One-page view
- Removed the Architecture Overview panel from `components/one-page-workspace.tsx`.
- Replaced it with a Community & Teams panel linking to public communities and friends teams.

## Public Communities
- Creating a community now creates/uses a public roadmap.
- Communities are discoverable to everyone.
- Community access defaults to request-based access.
- Collaborative access is granted separately by the community owner.
- Only the community owner can approve/reject community join requests.
- Once approved, members receive shared-roadmap edit access and group chat access.

## Friends Teams
- Teams are private friend groups around the same roadmap.
- Direct collaboration is enabled for members: no branch/PR approval is required for ordinary edits.
- Team join requests can be approved by any current member (or the owner).
- Invite-only teams still use the invite-link flow instead of a request button.
- Group chat remains available to all members.

## Validation
- 107 TypeScript/TSX files parsed successfully with TypeScript 5.8.3.
- 0 syntax/parser errors.
- Local `@/*` imports: PASS.
- Architecture text removed from one-page workspace: PASS.
- Community public roadmap creation: PASS.
- Community owner-only approval rule: PASS.
- Team direct collaboration setting: PASS.
- Group chat component present: PASS.

A full dependency-backed `next build` was not run because this source package does not include a usable installed dependency tree in the execution environment.
