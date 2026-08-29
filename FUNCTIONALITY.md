# Functionality Overview

This document summarizes how the application currently works (pages, APIs, auth model), and details the live collaboration feature added for shared roadmaps.

Keep this file updated as features change.

## High-level architecture
- Next.js (app router) using Server and Client components.
- Prisma + PostgreSQL as primary datastore.
- Server-side authentication through signed session cookie (`lib/server-auth.ts`) and `requireUser()` for server components and API routes.
- API routes (`app/api/...`) implement read/write operations protecting data via `withRls(userId, ...)` which sets the DB-level app.user_id session variable.

## Pages and rendering strategy
- Authenticated user pages (SSR / server components):
  - `/dashboard` — server component; fetches todos and daily logs with `requireUser()` + `withRls()` and renders. Small client component `components/dashboard-client.tsx` provides import/export and file UI.
  - `/roadmap` and editor pages — intended to be server components that fetch user data and delegate interactivity to client components like `components/roadmap-tree.tsx`.
  - `/settings`, `/calendar` — per-user pages; should be SSR.

- Public / share pages (SSG / ISR recommended):
  - `/share/[slug]` — public viewer for a roadmap (can be built static or server-rendered depending on desired freshness). Add `export const revalidate = 60` to enable ISR if needed.
  - `/templates` — list of templates (suitable for SSG/ISR).

## Client vs Server responsibilities
- Server components: perform authentication (`requireUser()`), fetch data via Prisma (`withRls()`), and render initial HTML for fast page loads.
- Client components: handle UI interactivity (drag/drop, forms, local state), file input, and subscribe to live updates (EventSource). Examples:
  - `components/roadmap-tree.tsx` — Client; interactivity for editing roadmap topics/resources and subscribes to collaboration SSE.
  - `components/dashboard-client.tsx` — Client; file import/export UI.

## API endpoints (summary)
- `GET/POST /api/todos` — list/create todos (date filtering). Uses `requireUser()` and `withRls()`.
- `GET/PUT /api/daily-logs` — read and update daily learning logs and statistics.
- `POST/GET /api/roadmaps`, `/api/roadmaps/[id]` — CRUD for roadmaps.
- `POST/PATCH/DELETE /api/topics`, `/api/topics/[id]` — topic CRUD.
- `POST/PATCH/DELETE /api/resources`, `/api/resources/[id]` — resource CRUD.
- `POST /api/share-requests` and share-related routes — send/share/accept flows.

Detailed API implementations are in `app/api/*`.

## Live Collaboration (real-time sync for shared roadmaps)
This project adds a lightweight collaboration layer to allow two (or more) users viewing the same roadmap to see each other's changes in near-real-time.

Design and components:
- In-memory pub/sub (development-only) — `lib/collab.ts` exposes `subscribe(roadmapId, handler)` and `publish(roadmapId, msg)` backed by a global Map on `globalThis`.
- Server-Sent Events (SSE) endpoint for subscriptions:
  - `GET /api/collab/[roadmapId]/events` — returns `text/event-stream`. Client subscribes with `new EventSource('/api/collab/<id>/events')`.
  - SSE sends heartbeat `ping` events and broadcasts any apply results.
- Apply endpoint for operations:
  - `POST /api/collab/[roadmapId]/apply` — authenticated endpoint which:
    - validates that the requester has access (owner or roadmap share),
    - applies the operation to the database inside `withRls(user.id, ...)`, and
    - publishes the result to subscribers via `publish(roadmapId, result)`.

Supported operations (implemented):
- `topic:create` — payload: `{ parentId?, title }` — creates a topic and returns `topic:create` with created topic.
- `topic:update` — payload: `{ id, data }` — updates topic fields (title/description/notes/status/progress/tags/dueDate/etc.).
- `topic:delete` — payload: `{ id }` — deletes topic.
- `resource:create` — payload: `{ topicId, title, url, ... }` — create resource.
- `resource:update` — payload: `{ id, data }` — update resource fields.
- `resource:delete` — payload: `{ id }` — delete resource.
- `roadmap:update` — payload: `{ data }` — updates roadmap metadata (title, description, privacy).
- `custom` — passthrough/broadcast-only for other client-side events.

Client behavior (current implementation):
- `components/roadmap-tree.tsx` routes topic/resource/roadmap changes through `POST /api/collab/[id]/apply` instead of direct REST endpoints.
- The component also opens an `EventSource` to `/api/collab/[id]/events` and, on receiving messages, reloads the roadmap via `load(id)` to keep state consistent. This is simple and safe; can be optimized later by applying patches locally.

Limitations and production guidance:
- The current pub/sub is in-memory and only works for a single Node process (development). For production / multi-instance setups, use a centralized broker:
  - Recommended choices: Redis Pub/Sub, Pusher, Ably, or a dedicated WebSocket server.
  - Replace `lib/collab.ts` with a Redis client that subscribes and publishes to a `collab:<roadmapId>` channel.
- Security: `POST /api/collab/[roadmapId]/apply` enforces access checks (owner or roadmap share). Ensure proper authentication and do not expose the apply endpoint to unauthenticated users.

## How synchronization is currently achieved (summary)
1. User A edits topic/resource in the roadmap UI.
2. Client sends a POST to `/api/collab/<roadmapId>/apply` with an operation (e.g. `topic:update`).
3. Server applies the change in the DB and broadcasts the resulting object via `publish()`.
4. Subscribers (other clients) receive the SSE message and call `load()` to refresh the roadmap.

## Environment variables
- `DATABASE_URL` — PostgreSQL connection string (required by Prisma). Example set in `.env.local`.
- `AUTH_SECRET` — secret used to sign session tokens; at least 32 characters.

## Developer commands
- Install and dev run:
  ```bash
  npm install
  npm run dev
  ```
- Validate Prisma schema:
  ```bash
  npm run db:validate
  ```
- Generate Prisma client and run DB setup script:
  ```bash
  npm run db:setup
  ```
- Build for production:
  ```bash
  npm run build
  npm start
  ```

## Next steps / recommended improvements
- Replace in-memory collab with Redis Pub/Sub (or managed realtime service) for production.
- Implement partial local state patches on SSE events rather than reloading the entire roadmap (lower latency, smaller payloads).
- Add optimistic UI updates with conflict resolution hints (e.g., last-writer-wins or CRDT-based merging for complex collaborative edits).
- Add tests around collaboration endpoints to validate access, operation semantics, and broadcast reliability.

---
Update this file when adding or changing APIs, collaboration behavior, or rendering strategy.

## Visual editor additions
- Roadmap Studio persists a visual editor state on each roadmap.
- Public roadmaps are discoverable in Community Roadmaps and remain restricted to `privacy=public` for discovery/chat recommendations.
- Workspace auto-sync defaults to every 3 minutes and inactivity logout defaults to 2 hours; both are environment-configurable.
- Prisma schema includes the inverse `Topic.topicShares` relation required by `TopicShare`.
