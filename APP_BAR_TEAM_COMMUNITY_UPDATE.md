# App Bar Team & Community Update

## Changes
- Added direct **Team** and **Community** creation actions to the desktop app bar.
- Added **Create Team** and **Create Community** actions to mobile navigation.
- Preserved the existing Add menu entries for both flows.
- Updated the Community navigation label to **Teams & Communities**.
- Kept Create Team / Create Community routed through the existing roadmap-selection flow:
  `/collaborate/create?type=team` and `/collaborate/create?type=community`.
- Team/community creation continues to support choosing an existing roadmap or creating a new roadmap first.

## Collaboration semantics verified
- Community creation makes the roadmap public and the community discoverable.
- Community collaboration access is owner-controlled.
- Team creation defaults to direct collaboration for members.
- Team join approvals can be handled by members; community approvals are owner-only.
- Invite link route grants roadmap access after capacity validation.
- Group chat is present in the collaboration workspace.

## Validation
- 108 TS/TSX/MJS source files parsed with TypeScript parser: 0 errors.
- Local `@/*` and relative imports: 0 unresolved imports.
- Targeted app-bar, create-flow, public-community, approval, invite-link, direct-collaboration, roadmap-access, chat, and TODO-nav checks: all passed.
- A full dependency-backed Next.js production build was not available because dependency installation timed out in the execution environment.
