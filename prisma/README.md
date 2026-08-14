# Database setup

Roadmap uses only the PostgreSQL database supplied through `DATABASE_URL`.

1. Copy `.env.example` to `.env.local`.
2. Put your Aiven PostgreSQL connection string in `DATABASE_URL`.
3. Set a random `AUTH_SECRET` of at least 32 characters.
4. Run `npm run db:setup`.
5. Run `npm run dev`.
