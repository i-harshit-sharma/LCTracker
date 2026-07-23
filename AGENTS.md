# LeetCode Sync Hub - Agent Instructions

## Project Overview

LeetCode Sync Hub (LCTracker) is a full-stack social platform to track, sync, and visualize LeetCode progress. Users follow each other, view activity feeds, receive notifications, and explore 3D "Skyline" visualizations.

**Stack**: TypeScript monorepo (pnpm workspaces) — React 18 + Vite + Tailwind (frontend), Express 5 (backend), Drizzle ORM + PostgreSQL, Clerk auth, React Query + React Query hooks (generated from OpenAPI), React Three Fiber for 3D Skyline.

---

## Commands (run from repo root)

```bash
# Install deps
pnpm install

# Type-check all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Run unit tests
pnpm run test:unit

# Run e2e tests
pnpm run test:e2e

# Lint/format
pnpm run lint

# Generate API client (from OpenAPI spec)
pnpm run generate:api

# Database push (schema sync)
pnpm --filter @workspace/db run push

# Dev servers
pnpm --filter @workspace/lc-tracker run dev   # Frontend (Vite, port 5173)
pnpm --filter @workspace/api-server run dev   # Backend (Express, port 3000)

# Production deploy
./start.sh
```

---

## Code Style (TypeScript / React / Node)

| ✅ Right                                            | ❌ Wrong                                  |
| --------------------------------------------------- | ----------------------------------------- |
| `const [state, setState] = useState<Type>(initial)` | `useState(initial)` without type          |
| `import type { Foo } from '...'` for types          | `import { Foo } from '...'` for types     |
| `const x: Type = ...` explicit types on const       | `const x = ...` implicit any              |
| `export function foo(): ReturnType {}`              | `export const foo = (): ReturnType => {}` |
| `@ts-expect-error` with comment                     | `@ts-ignore`                              |
| `import { z } from 'zod'` + `z.object({...})`       | manual validation                         |

**Stack versions**: TypeScript 5.9, React 18, Vite 5, Express 5, Drizzle ORM, TanStack Query 5, Zod 3, Vitest 4, pnpm 9.

---

## Project Structure (Key Paths)

```
├── artifacts/
│   ├── lc-tracker/        # Frontend (React + Vite)
│   └── api-server/        # Backend (Express 5)
├── lib/
│   ├── db/                # Drizzle schema & migrations
│   ├── api-spec/          # OpenAPI spec + Orval config
│   ├── api-zod/           # Generated Zod schemas
│   └── api-client-react/  # Generated React Query hooks
├── scripts/               # Build scripts (version-bump, recalculate-profiles)
├── vitest.config.ts       # Test config
├── start.sh               # Production deploy script
└── Caddyfile              # Reverse proxy config
```

---

## Boundaries (Do Not Touch)

| Path                                          | Reason                                                                |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `lib/api-zod/**`                              | Auto-generated from OpenAPI — regenerate via `pnpm generate:api`      |
| `lib/api-client-react/**`                     | Auto-generated React Query hooks — regenerate via `pnpm generate:api` |
| `lib/db/migrations/**`                        | Drizzle migrations — use `pnpm --filter @workspace/db run push`       |
| `artifacts/lc-tracker/src/.generated/**`      | Generated mock components                                             |
| `.env*` / `.env.*`                            | Secrets — never commit                                                |
| `dist/`, `build/`, `node_modules/`, `.turbo/` | Build artifacts                                                       |
| `.github/workflows/`                          | CI/CD — modify only if CI changes needed                              |

---

## Key Workflows

1. **API changes**: Edit `lib/api-spec/openapi.yaml` → `pnpm generate:api` → types/hooks regenerated in `lib/api-zod` & `lib/api-client-react`
2. **DB schema**: Edit `lib/db/schema.ts` → `pnpm --filter @workspace/db run push` → migration created
3. **Frontend hooks**: Import from `@workspace/api-client-react` (e.g., `useGetProblemsQuery()`)
4. **Poller/Backend sync**: Edit `artifacts/api-server/src/lib/poller.ts` (GraphQL poller, 5-min cron)

---

## Testing

```bash
# Unit tests (Vitest)
pnpm run test:unit

# E2E tests (run in CI)
pnpm run test:e2e

# Unit test config: vitest.config.ts (node env, globals, include **/*.test.ts[x])
```

---

## Deployment (Production)

```bash
./start.sh
# Or manually:
pnpm install && pnpm run build
pnpm --filter @workspace/db run push
NODE_ENV=production pm2 start "pnpm --filter @workspace/api-server run start" --name leetcode-api
caddy reload --config Caddyfile
```

---

## References

- Architecture: `ARCHITECTURE.md`
- Deployment: `deployment.md`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Drizzle schema: `lib/db/schema.ts`
- Poller logic: `artifacts/api-server/src/lib/poller.ts`
- Frontend Skyline: `artifacts/lc-tracker/src/pages/skyline.tsx`

---

## Skills

- Skills directory: `.opencode/skill/` — contains reusable agent skills
- **caveman** (`.opencode/skill/caveman/SKILL.md`) — primitive but effective debugging skill; use by default at full level for all tasks
- **customize-opencode** (built-in) — use ONLY when editing opencode's own configuration (opencode.json, .opencode/, ~/.config/opencode/); not for application code
- **find-skills** (`C:\Users\user\.agents\skills\find-skills\SKILL.md`) — helps discover and install agent skills; use when user asks "how do I do X" or "find a skill for X"
- **frontend-design** (`C:\Users\user\.agents\skills\frontend-design.md`) — Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
- **web-design-guidelines** (`C:\Users\user\.agents\web-design-guidelines.md`) — helps when a user asks to build a feature; Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices"
