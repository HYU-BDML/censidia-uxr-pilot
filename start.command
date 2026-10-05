#!/bin/zsh
set -e
cd "${0:A:h}"
# Prefer the locally installed Node with built-in SQLite support.
if [[ -x /opt/homebrew/bin/node ]] && /opt/homebrew/bin/node -e "require('node:sqlite')" >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:$PATH"
fi
node -e "require('node:sqlite')" || { echo "Node.js 22.13 이상이 필요합니다."; exit 1; }
if [[ ! -d node_modules ]]; then npm install; fi
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
