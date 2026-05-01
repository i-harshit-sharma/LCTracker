# Deployment Guide - LeetCode Sync Hub

Follow these steps to build and publish the application for production using Caddy.

## 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)
- [Caddy](https://caddyserver.com/) installed on your server
- [PM2](https://pm2.keymetrics.io/) installed globally (`npm install -g pm2`)

## 2. Environment Configuration
Ensure you have a `.env` file in the root directory with the following production values:
- `DATABASE_URL`: Your production Postgres connection string
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
- `CLERK_SECRET_KEY`: Your Clerk secret key
- `PORT`: 3000

## 3. Initial Build and Setup
For the first-time setup, run:

```bash
# Install dependencies
pnpm install

# Update database schema
pnpm --filter @workspace/db run push

# Build all packages
pnpm run build
```

## 4. Run the Backend
Start the backend server using PM2 to keep it running:

```bash
NODE_ENV=production pm2 start "pnpm --filter @workspace/api-server run start" --name leetcode-api
```

## 5. Start Caddy
With the `Caddyfile` in the root directory, start Caddy:

```bash
# Start Caddy in background
caddy start --config Caddyfile
```

## 6. Automated Updates (Recommended)
I have provided a `start.sh` script that automates the update process. It pulls the latest code, installs dependencies, builds the project, and restarts both the API and Caddy.

```bash
# 1. Make the script executable
chmod +x start.sh

# 2. Run it whenever you want to deploy latest changes
./start.sh
```

## 7. Verification
- Visit `http://your-server-ip` or your configured domain.
- Check `artifacts/api-server/logs/server.json` for backend logs.
- Verify that notifications and activity feeds are updated.
