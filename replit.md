# LCTracker — LeetCode Follower Platform

## Overview

Full-stack social platform where users follow LeetCode problem solvers, see a real-time activity feed, get in-app notifications, and receive a daily digest email. Built as a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (`artifacts/lc-tracker`) — served at `/`
- **Backend**: Express 5 API server (`artifacts/api-server`) — served at `/api`
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Clerk (`@clerk/react` + `@clerk/express`)
- **API contract**: OpenAPI spec (`lib/api-spec`) → Orval codegen
- **API client hooks**: `@workspace/api-client-react` (React Query)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Email**: Resend (`RESEND_API_KEY` env var — optional, logs if not set)
- **Polling**: Custom LeetCode GraphQL poller in `artifacts/api-server/src/lib/poller.ts`
- **Cron**: `node-cron` — daily digest at 23:59 UTC + poll every 5 min

## Architecture

```
/                  → lc-tracker React app (Vite)
/api               → api-server Express app
/api/__clerk       → Clerk proxy middleware
```

## Database Schema (`lib/db/src/schema/`)

- `users` — Clerk user sync (created on first API call via auth middleware)
- `follows` — userId → leetcodeUsername mappings + cached profile data
- `solvedProblems` — per-username solved problem log (deduped by slug)
- `notifications` — in-app notifications per user

## Frontend Pages

- `/` — Public landing page (redirects signed-in users to `/dashboard`)
- `/sign-in/*?` — Clerk sign-in (dark themed, branded)
- `/sign-up/*?` — Clerk sign-up (dark themed, branded)
- `/dashboard` — Activity feed + weekly leaderboard + stats
- `/follows` — Follow/unfollow LeetCode usernames
- `/notifications` — In-app notifications with mark-as-read
- `/profiles/:username` — Public LeetCode profile with difficulty breakdown

## Backend Routes (`artifacts/api-server/src/routes/`)

- `GET/POST /api/follows` — list and create follows
- `DELETE /api/follows/:id` — unfollow
- `GET /api/notifications` — list notifications (supports `?unreadOnly=true`)
- `PUT /api/notifications/read-all` — mark all read
- `PUT /api/notifications/:id/read` — mark one read
- `GET /api/activity` — activity feed (solved problems by followed users)
- `GET /api/activity/stats` — today/week stats
- `GET /api/leaderboard` — weekly leaderboard
- `GET /api/profiles/:username` — LeetCode profile + recent problems

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild composite libs (run after schema changes)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Important Notes

- After adding tables to `lib/db/src/schema/`, run `pnpm run typecheck:libs` to rebuild so API server picks them up
- `lib/api-zod/src/index.ts` must stay as `export * from "./generated/api"` only — codegen regenerates it
- LeetCode polling uses public GraphQL endpoint, no auth key needed, rate-limited with 3s delay + exponential backoff
- Email is graceful — if `RESEND_API_KEY` is not set, digest is logged but not sent
- Dark mode is default (set via `document.documentElement.classList.add("dark")` in App.tsx)
- Clerk proxy path: `/api/__clerk`

## Environment Variables

- `CLERK_SECRET_KEY` — auto-provisioned by Clerk integration
- `CLERK_PUBLISHABLE_KEY` — auto-provisioned
- `VITE_CLERK_PUBLISHABLE_KEY` — auto-provisioned
- `VITE_CLERK_PROXY_URL` — auto-set in production
- `SESSION_SECRET` — set in secrets
- `DATABASE_URL` — auto-set by Replit PostgreSQL
- `RESEND_API_KEY` — optional; set to enable daily digest emails
