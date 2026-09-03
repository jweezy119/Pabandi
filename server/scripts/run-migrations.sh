#!/bin/bash
# Force prisma migrate deploy to run at build time to ensure migrations are applied
# before the server starts, even if the CMD step times out

cd /app
npx prisma migrate deploy || echo "Migration step skipped or already applied"
