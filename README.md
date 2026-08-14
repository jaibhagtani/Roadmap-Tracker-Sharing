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
