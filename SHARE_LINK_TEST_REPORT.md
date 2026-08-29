# Share Link & Scoped Layer Sharing Test Report

## Implemented
- Roadmap share links remain available through `/share/[slug]`.
- Team invite links remain available through `/collaborate/group/join/[token]`.
- Added topic/layer share links through `/share/topic/[token]`.
- Topic share links expose the selected topic plus every descendant/child only.
- Parent, siblings, and unrelated roadmap branches are excluded.
- Topic links are generated only by the roadmap owner.
- Topic links can be revoked; revoked tokens return 404 and their Redis cache entry is invalidated.
- Reusing "Create layer link" returns the existing token instead of rotating it.
- Topic layer sharing is available from the roadmap tree inspector and the roadmap editor inspector.
- Existing user-to-user topic sharing remains supported through `scopeType: topic` and `rootTopicId`.
- Shared topic links are read-only; they do not expose editing controls.

## Static validation
- 116 TS/TSX files parsed: 0 parser errors.
- `@/*` local import resolution: 0 unresolved imports.
- Required share route files present.
- Prisma schema contains `Topic.shareToken`.
- SQL bootstrap adds `topics.share_token` safely for fresh and existing databases.
- Prisma migration added for `share_token`.
- No `FLUSHALL` / `FLUSHDB` introduced.

## Runtime limitation
A full Next.js/Prisma runtime build could not be executed in this environment because the project dependencies are not installed locally. The validation above is static/source-level; production runtime validation still needs to be run with the project's dependencies and database connected.
