# Team / Community flow validation

## Static validation
- 109 TypeScript/TSX files parsed with TypeScript 5.8.3: PASS (0 parser errors).
- `@/*` local alias imports: PASS (0 unresolved local aliases).
- Key route/component files present: PASS.
- One-page architecture overview removed: PASS.

## Team flow
1. App bar -> Create Team -> `/collaborate/create?type=team`: PASS.
2. Team name + cohort + description + member limit collected before roadmap: PASS.
3. Friend search and multi-select invite list before roadmap creation: PASS.
4. New or existing roadmap selection after team setup: PASS.
5. Team creation sets `kind=team`, `directCollaboration=true`, invite-first access mode: PASS.
6. Initial invitees are added after group creation: PASS.
7. Redirect goes to the roadmap collaboration page with `#group-chat`: PASS.
8. Group info includes Create roadmap, Invite members, Open editor, Group chat: PASS.
9. Additional roadmaps can be attached to the same group through `/api/collab/group/[groupId]/roadmaps`: PASS.
10. Group members receive roadmap shares for newly attached roadmaps: PASS.
11. Team join via invite link grants direct membership and shares across attached roadmaps: PASS.
12. Team members can use direct same-roadmap collaboration without review: PASS.

## Community flow
1. App bar -> Create Community -> `/collaborate/create?type=community`: PASS.
2. Community setup is separate from team setup: PASS.
3. Community-created roadmap is public: PASS.
4. Community is discoverable: PASS.
5. Community collaboration is permission-gated (`directCollaboration=false`): PASS.
6. Community join request path exists and is owner-approved: PASS.
7. Community invite link creates a collaboration request rather than granting edit access: PASS.
8. Community owner approval grants roadmap access across attached community roadmaps: PASS.
9. Non-owner community members cannot approve join requests: PASS.
10. Public community still has group chat for members: PASS.

## Group management
- Invite members from Group info: PASS.
- Create additional roadmap from Group info: PASS.
- Group chat deep link: PASS.
- Same group identity preserved across attached roadmaps: PASS.
- Roadmap-specific collaboration workspace reused for each attached roadmap: PASS.

## Runtime limitation
A full Next.js production build / browser E2E run was not possible because the project ZIP does not include installed dependencies and package installation was unavailable in this execution environment. The report therefore does not claim a production-build pass.
