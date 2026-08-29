# Notification roadmap actions

Notifications related to roadmap sharing/collaboration now carry a resolvable roadmap reference. The notification API enriches notifications from direct roadmap links, share requests, community join requests, and collaboration commits.

Recipients can see **Open roadmap**, **Clone**, and, where collaboration is allowed, **Collaborate**. Public notifications remain view-only and do not expose a collaboration action. Direct private shares remain protected by the existing roadmap share permission; cloning is authorized server-side and creates an independent roadmap with fresh IDs through `cloneRoadmap`.

Direct roadmap-share notifications now persist `roadmapId` on the notification row. A migration was added for this field. Notification cache keys were versioned to prevent stale notification payloads from hiding the new roadmap metadata.
