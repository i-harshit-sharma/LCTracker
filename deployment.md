# Deployment Guide - LeetCode Sync Hub

Follow these steps to build and publish the application for production using Caddy.

## 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)
- [Caddy](https://caddyserver.com/) installed on your server

## 2. Environment Configuration
Ensure you have a `.env` file in the root directory (or in the respective package directories) with the following production values:
- `DATABASE_URL`: Your production Postgres connection string
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
- `CLERK_SECRET_KEY`: Your Clerk secret key
- `PORT`: 3000 (standard for our backend)

## 3. Build the Application
Run the following commands from the project root to build the backend and frontend:

```bash
# Install dependencies
pnpm install

# Build the API server
pnpm --filter @workspace/api-server run build

# Build the React frontend
pnpm --filter @workspace/lc-tracker run build
```

The frontend assets will be generated in `artifacts/lc-tracker/dist/public`.

## 4. Run the Backend
Start the backend server using the production bundle. You may want to use a process manager like `pm2`.

```bash
# Set environment variables and start
NODE_ENV=production PORT=3000 pnpm --filter @workspace/api-server run start
```

## 5. Start Caddy
With the `Caddyfile` in the root directory, start Caddy to serve the frontend and proxy requests:

```bash
# Validate the Caddyfile
caddy validate --config Caddyfile

# Start Caddy (background)
caddy start --config Caddyfile
```

## 6. Verification
- Visit `http://your-server-ip` or the configured domain.
- Check `artifacts/api-server/logs/server.json` for backend logs.
- Verify that notifications and activity feeds are working correctly.
