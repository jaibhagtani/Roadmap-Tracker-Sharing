# Community Card Roadmap Access Update

- Community cards no longer expose `View roadmap` before collaboration access is approved.
- Approved members and the community owner see `View roadmap` and `Open community`.
- Pending join requests show `Request pending` only.
- Users without membership see `Request collaboration` only.
- `/api/communities` now returns `isOwner` so owner access is explicit and does not depend on a membership row.
- Public standalone roadmap cards are unchanged; this rule applies to roadmap links presented on community cards.
