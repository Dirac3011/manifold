#!/bin/sh
set -e

echo "Applying database schema..."
npx prisma db push

echo "Starting Manifold..."
exec npx tsx server.ts
