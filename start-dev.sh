#!/bin/sh
export PATH="/opt/homebrew/Cellar/node/26.0.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev -- --port 5175
