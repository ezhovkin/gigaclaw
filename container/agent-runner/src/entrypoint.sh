#!/bin/bash
set -e
[ -f /workspace/env-dir/env ] && export $(cat /workspace/env-dir/env | xargs)
cat > /tmp/input.json
env $(cat /workspace/env-dir/env | xargs) node /app/dist/index.js < /tmp/input.json
