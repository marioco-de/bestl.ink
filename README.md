# bestl.ink

Gated content sharing: short links, documents, proxy pages, calendar events (`.ics`) and contacts (`.vcf`).

## Stack

React 19, TypeScript, Vite, TanStack Start, Tailwind v4, PGLite/Postgres.

## Setup

```bash
npm install
cp .env.example .env
# fill EMAILIT_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev
```

```bash
npm run build
npm run typecheck
```

Set the same env vars on Vercel. Add `bestl.ink` and `*.bestl.ink` as project domains (wildcard needs Vercel nameservers).

## Workspace links

Public short links live on `{workspace}.bestl.ink/{code}` (e.g. `mario-kempter.bestl.ink/dd2vn`).
