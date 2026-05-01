#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Automated Deployment..."

# 1. Pull latest changes from git
echo "📥 Pulling latest changes..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# 3. Update database schema
echo "🗄️ Syncing database schema..."
pnpm --filter @workspace/db run push

# 4. Build all packages (frontend + backend)
echo "🛠️ Building project..."
pnpm run build

# 5. Restart API server
echo "🔄 Restarting API server..."
# We use PM2 to manage the process and ensure it restarts cleanly
if pm2 list | grep -q "leetcode-api"; then
    pm2 restart leetcode-api
else
    NODE_ENV=production pm2 start "pnpm --filter @workspace/api-server run start" --name leetcode-api
fi

# 6. Reload or Start Caddy configuration
echo "🌐 Updating Caddy..."
# Try to reload. If it fails (usually because it's not running), start it fresh.
caddy reload --config Caddyfile || caddy start --config Caddyfile

echo "✅ Deployment successful! App is now up to date."
