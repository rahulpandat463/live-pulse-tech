#!/bin/sh
# entrypoint.sh - Run seed then start the server
set -e
echo "Running database seed..."
node src/db/seeds/seed.js
echo "Starting server..."
exec node src/app.js
