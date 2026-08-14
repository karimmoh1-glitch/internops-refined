#!/bin/sh
export DATABASE_URL="postgresql://karimmohamed@localhost:5432/internops_main_dev"
export JWT_SECRET="dev-secret-change-me"
export PORT=5001
cd "$(dirname "$0")/.."
exec "$HOME/.local/bin/node" node_modules/tsx/dist/cli.mjs server/index.ts
