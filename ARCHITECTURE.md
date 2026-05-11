# Technical Architecture Specification: LeetCode Sync Hub (LCTracker)

## 1. Overview

LeetCode Sync Hub (LCTracker) is a full-stack social platform designed to track, synchronize, and visualize LeetCode progress for individuals and communities. It allows users to follow each other, view real-time activity feeds, receive notifications, and explore progress through immersive 3D "Skyline" visualizations.

## 2. System Architecture

The project is structured as a **TypeScript-first Monorepo** managed by `pnpm` workspaces. This architecture ensures type safety across the entire stack, from database schema to frontend components.

### 2.1 Component Breakdown

- **Frontend (`artifacts/lc-tracker`)**: A modern SPA built with **React**, **Vite**, and **Tailwind CSS**. It uses **Wouter** for routing and **React Query** for state management and data fetching.
- **Backend (`artifacts/api-server`)**: An **Express 5** server that handles authentication, API requests, and background synchronization tasks.
- **Shared Libraries (`lib/`)**:
  - `db`: Database models and migrations using **Drizzle ORM**.
  - `api-spec`: OpenAPI contract for the entire system.
  - `api-zod`: Auto-generated Zod schemas for request/response validation.
  - `api-client-react`: Auto-generated React Query hooks for the frontend.
- **Synchronization Engine**: A custom GraphQL poller that scrapes LeetCode data without requiring official API keys.

---

## 3. Data Architecture

The system uses **PostgreSQL** as its primary data store, managed via **Drizzle ORM**.

### 3.1 Core Entities

- **Users**: Managed via **Clerk** authentication. Profiles are synchronized to the local database upon first login.
- **Follows**: Maps users to the LeetCode usernames they are tracking. It also caches basic profile data (avatar, display name) to minimize external API calls.
- **Solved Problems**: A log of every problem solved by tracked users. Each entry is de-duplicated using the problem's slug and submission ID.
- **Notifications**: In-app alerts triggered when followed users solve problems or achieve milestones.
- **Scanner Metadata**: Tracks the status of the synchronization engine (last run time, success/failure).

---

## 4. API Design & Communication

The project follows a **Contract-First API** approach.

1.  **OpenAPI Spec**: Defined in `lib/api-spec`.
2.  **Code Generation**: `Orval` is used to generate:
    - Zod schemas for the backend.
    - React Query hooks for the frontend.
3.  **Authentication**: Secured by **Clerk**. The backend uses a custom `requireAuth` middleware to verify Clerk JWTs.

---

## 5. Data Synchronization Engine (The Poller)

The "heart" of the project is the **LeetCode Poller** (`artifacts/api-server/src/lib/poller.ts`).

- **Mechanism**: Periodically executes GraphQL queries against `leetcode.com/graphql`.
- **Concurrency**: Processed in batches with a 3-second delay between requests to prevent rate-limiting.
- **Scheduling**: Uses `node-cron` to poll every 5 minutes and generate daily digest emails at 23:59 UTC.
- **Deduplication**: Uses a combination of `leetcodeUsername`, `problemSlug`, and `solvedAt` to ensure no duplicate entries in the activity feed.

---

## 6. Frontend & Visualization

The frontend is designed for high performance and visual impact.

### 6.1 State Management

- **Server State**: Managed by **TanStack Query (React Query)**, ensuring efficient caching and background updates.
- **Global State**: Minimal use of React Context for UI-specific states (e.g., theme).

### 6.2 3D Skyline Feature

Located in `artifacts/lc-tracker/src/pages/skyline.tsx`, this feature uses **React Three Fiber** (inferred from `ContributionCity` and `CommunityCity` components) to render:

- **Personal City**: Daily solve counts mapped to building heights over 365 days.
- **Community City**: A competitive landscape where top performers are represented by skyscrapers.

### 6.3 Analytics

Integrated with **PostHog** for feature flags (e.g., the onboarding tour) and user behavior tracking.

---

## 7. Infrastructure & Deployment

The project is optimized for both Replit and standalone Linux servers.

- **Reverse Proxy**: **Caddy** handles SSL termination and routes requests (`/` to frontend, `/api` to backend).
- **Process Management**: **PM2** ensures the Node.js backend remains operational and restarts on failure.
- **CI/CD**: **GitHub Actions** automate the deployment process, syncing the codebase and restarting services.
- **Static Assets**: Vite builds the frontend into a `dist` folder, which is served as static files.

---

## 8. Key Workflows

1.  **Onboarding**: User signs in via Clerk → Redirected to Verification → Enters LeetCode username → System starts initial poll.
2.  **Activity Feed**: Poller finds new solves → Saves to DB → Triggers PostHog event → UI refreshes via React Query.
3.  **Leaderboard**: Backend executes complex SQL aggregates via Drizzle to rank users by weekly/all-time solve counts.
