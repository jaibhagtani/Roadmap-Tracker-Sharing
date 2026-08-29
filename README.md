# Roadmap — Learning OS

Roadmap is a Next.js + TypeScript learning roadmap tracker. **The application uses Aiven PostgreSQL directly through `DATABASE_URL`. There is no Supabase dependency.**

## Environment

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL` — your Aiven PostgreSQL connection string.
- `AUTH_SECRET` — a random server-only secret of at least 32 characters used to sign sessions.
- `NEXT_PUBLIC_APP_URL` — the app origin used in password-reset links.

Do not commit `.env.local` or any credentials.

## Database setup

```bash
npm install
npm run db:setup
npm run dev
```

`db:setup` generates Prisma Client and executes the idempotent SQL schema at `db/migrations/0001_init.sql` directly against `DATABASE_URL`.

## Authentication

Authentication is implemented in the application itself and stored in Aiven PostgreSQL:

- `users` — account identity and password hash
- `sessions` — signed, database-backed login sessions
- `password_reset_tokens` — expiring password reset tokens
- HttpOnly `roadmap_session` cookie
- `middleware.ts` protects application routes
- Login, signup, logout, forgot-password and reset-password are all served by `/api/auth/*`

Passwords are hashed with Node's `scrypt`; raw passwords are never stored. Sessions are signed with `AUTH_SECRET` and verified again against the database on every server-side authenticated request.

## Data ownership

Every application write uses the authenticated user ID from the current Roadmap session. Roadmaps, topics, resources, daily logs, todos, profiles, sharing requests, notifications and shares are all stored in Aiven PostgreSQL. PostgreSQL RLS uses the transaction-local `app.user_id` value set by `withRls(userId, ...)`.

## Sharing

Sharing is ID-based. A receiver gives the sender their Roadmap User ID. The sender creates a share request, which is stored in the database and creates a persistent notification. The receiver can accept, reject or clone. Topic shares grant the selected topic and descendants while retaining the sender as owner; cloning creates an independent copy with new UUIDs.

## Calendar

The calendar stores daily learning logs and date-specific todos in PostgreSQL. Todos support add, edit, complete/uncomplete and delete.

## Verification

After installation:

```bash
npm run db:validate
npm run build
```

The live Aiven connection must be available when running `npm run db:setup`.

## Collaboration

Roadmap collaboration is backed entirely by Aiven PostgreSQL. There is no Supabase or external realtime dependency. The workflow is intentionally GitHub-like: **one roadmap owner is the leader; collaborators do not write directly to the leader's main roadmap.**

- The leader is always the roadmap owner.
- A user can receive a collaboration invite or request to join a public/link roadmap. The leader accepts or rejects the request.
- Accepted collaborators get `contributor` access. Viewers remain read-only.
- Contributors create a private branch from the latest main roadmap (or a shared topic subtree).
- Contributors make edits on the branch and press **Commit & Push**.
- A commit stores the complete branch snapshot, author, base version and message in PostgreSQL.
- The leader sees pending commits as pull requests and can **Accept & Merge** or Reject.
- Merge is guarded by the branch base version. If main changed, the leader gets a merge conflict instead of silently overwriting newer work.
- After merge, the main roadmap version and collaboration event log update, so all viewers see the accepted change when their workspace syncs.
- Branches and commits are database-backed and survive Vercel/serverless instances and browser refreshes.
- Whole-roadmap sharing and topic-subtree sharing remain supported; cloning creates a new independent roadmap with new UUIDs.
- The collaboration workspace is `/collaborate/[roadmapId]`.

## Roadmap Community Groups

Each roadmap can have one owner-led community group. The roadmap owner is the leader and controls membership.

- Default capacity is 10 members including the owner.
- The owner can change the capacity between 2 and 100.
- The owner can enable/disable join requests and change the group name/description.
- Members can request to join a discoverable group; the owner must accept or reject each request.
- Accepted members receive contributor access to the roadmap and can use the Git-style branch, commit & push, and pull-request workflow.
- The owner can remove members. Members can leave themselves; the owner cannot leave the group.
- Join requests, approvals, rejections, additions, and removals create database-backed notifications.
- Community state is stored in Aiven PostgreSQL and is safe across Vercel/serverless instances.

## UI / Collaboration refresh

The current frontend now uses a roadmap.sh-inspired visual workspace with:

- A real node-and-edge roadmap canvas powered by React Flow, with smooth tree connectors, zoom/pan, minimap, progress bars, status states, expand/collapse and topic search.
- Topic detail editing with resources, tags, notes, status and progress, plus quick add-child actions directly on roadmap nodes.
- A responsive navigation shell with desktop sidebar and mobile navigation.
- Dashboard learning stats, streak/activity visualization, daily tasks and backup actions.
- A discoverable Community directory backed by the existing owner-controlled collaboration group APIs, including join requests and capacity states.
- Git-style collaboration already present in the backend: communities, member approval, configurable member limits, branches, commits, pull-request review, live activity, presence and collaboration chat.

The collaboration model remains owner-controlled: a roadmap owner creates the community, chooses the member limit (default 10), reviews join requests, and accepts/rejects members. Contributors can work in branches and push commits for leader review before merge.
## CI

GitHub Actions runs the CI pipeline for both `main` and `non-prod`. It runs on pull requests targeting either branch and again after changes are merged/pushed to either branch. The pipeline installs dependencies, generates the Prisma client, validates the Prisma schema, runs TypeScript checks, and builds the Next.js application.

Workflow: `.github/workflows/ci.yml`


## Redis caching

Set `REDIS_URL` in the environment. Redis is used as a best-effort acceleration layer for dashboard data, roadmaps, search, notifications, community discovery and public roadmap views. User cache keys are versioned and mutations bump the user version so stale user data is bypassed immediately. Public roadmap caches use per-roadmap versions and are bumped when public roadmap content changes.

The application never calls `FLUSHALL` or `FLUSHDB`. Cache cleanup is namespace-scoped to `REDIS_KEY_PREFIX`; `flushAppCache()` is available for safe maintenance without touching other applications sharing the same Redis instance.

## Roadmap Assistant

The floating Roadmap Assistant recommends only content attached to `public` roadmaps. It searches public roadmap titles, descriptions and public resources and returns direct links; private and link-only roadmaps are never included.

## Visual Roadmap Studio

The main `/roadmap` workspace is a visual editor inspired by diagram/roadmap builders. It includes a left component palette (Title, Topic, Sub Topic, Paragraph, Button, Legend, Links Group, Horizontal/Vertical Line and Section), a React Flow canvas with tree connectors, pan/zoom/minimap, and a right inspector for topic/resource/block editing. Canvas positions and visual blocks are persisted in `roadmaps.editor_state`.

### Workspace navigation

The authenticated top app bar exposes Dashboard, My Roadmaps, Templates, Shared, Community Roadmaps, Teams, Calendar, TODO and Notifications. Community Roadmaps contains public roadmaps only; Teams contains owner-managed collaboration groups.

### Automatic refresh and inactivity

Authenticated workspaces dispatch a synchronized refresh every 3 minutes by default (`NEXT_PUBLIC_APP_SYNC_MS=180000`). Users are forced back to login after 2 hours without activity by default (`NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS=7200000`). Both values can be adjusted in `.env`.

## Session, notifications and offline safety

- Inactivity warning appears during the final configurable warning window (default 5 minutes) before logout. `Continue Session` resets the inactivity window.
- Notification unread count is pinged from the app bar every 5 minutes; opening notifications performs a fresh backend ping and fetch.
- Authenticated server pages use server-rendered initial data where practical (dashboard, roadmap shell, notifications), while interactive editors remain client components.
- API GET responses and failed API mutations are persisted in browser local storage while offline. Failed mutations are replayed when connectivity returns. The roadmap editor also keeps a local draft and automatically recovers it.

Environment controls:

```env
NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS=7200000
NEXT_PUBLIC_INACTIVITY_WARNING_MS=300000
NEXT_PUBLIC_APP_SYNC_MS=180000
```

## UI modes and architecture

- `GET /roadmap` opens the full visual Roadmap Studio.
- `GET /roadmap?view=one-page` opens the one-page workspace with the editor plus calendar, tasks and sharing panels.
- The top app bar `Add` menu exposes Roadmap Studio, 1-page workspace, Topic, Task, Team and Community Roadmap actions.
- `architecture.html` documents the end-to-end architecture, persistence boundaries, Redis strategy, offline-first behavior, collaboration, notifications, session lifecycle, SSR boundaries, deployment and testing checklist.
