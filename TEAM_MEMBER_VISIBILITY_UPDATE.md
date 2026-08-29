# Team Member Visibility Update

- `/collaborate` now loads all groups where the signed-in user is the owner OR a member.
- Joined/invited team members see those teams in the Teams & communities section.
- Team cards show member/owner state, group kind, attached roadmap, and member count.
- Direct-collaboration teams link to `/team-activity/[groupId]`.
- Community groups link to their collaboration workspace.
- Existing invite endpoint creates membership immediately for teams and notification is sent to the invited user, so the group appears on the next `/collaborate` render.
- Existing invite-link join endpoint also creates team membership and grants roadmap shares.
