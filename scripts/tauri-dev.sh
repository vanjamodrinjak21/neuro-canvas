#!/bin/bash
# Close inherited file descriptors from Tauri/Cargo to prevent
# esbuild "spawn EBADF" errors during Vite dev server startup
for fd in $(seq 3 200); do
  eval "exec $fd<&-" 2>/dev/null
done
exec npm run dev
