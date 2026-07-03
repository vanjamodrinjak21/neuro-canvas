# Build stage
#
# Base image MUST be glibc (Debian), NOT Alpine/musl.
#
# Why: the server-side document-ingestion pipeline embeds chunks with
# @huggingface/transformers, which loads the native `onnxruntime-node`
# addon (bin/napi-v6/linux/x64/libonnxruntime.so.1). That prebuilt shared
# object is linked against glibc and references fortified symbols such as
# `__vsnprintf_chk` that musl libc does NOT provide (and `libc6-compat`/
# gcompat does not implement the `_chk` variants). On Alpine this fails at
# dlopen relocation time with "symbol not found", which surfaced as
# "Server-side embedding unavailable" and broke RAG ingestion in prod.
# A glibc base resolves every symbol and lets the addon load as designed.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build deps for native modules (bcrypt, better-sqlite3) + OpenSSL for Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and prisma config
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies with all postinstall scripts skipped.
# Why: onnxruntime-node's postinstall pulls Microsoft NuGet binaries, which
# routinely time out from Railway's europe-west4 region. We don't need that
# download — onnxruntime-node@1.24.3 already bundles the linux/x64 glibc
# .so in its npm tarball, and a glibc base (above) makes it loadable.
# Why not --omit=optional: triggers npm bug #4828 that drops required
# optional native bindings like @oxc-parser/binding-linux-x64-gnu.
RUN npm ci --legacy-peer-deps --ignore-scripts

# Manually rebuild the native deps we DO need (Nuxt Content uses better-sqlite3
# during `nuxt build` for the docs cache; bcrypt is used at runtime by auth).
RUN npm rebuild better-sqlite3 bcrypt

# Apply dependency patches — postinstall's `patch-package` was skipped by
# --ignore-scripts above, so it must run manually here.
# Why: next-auth 4.24.x dropped the `./core` subpath from its exports map,
# but @sidebase/nuxt-auth's server handler imports `next-auth/core`. Without
# the patch, `nuxt build` dies at prerender init (ERR_PACKAGE_PATH_NOT_EXPORTED)
# and the unpatched package.json traced into .output/server/node_modules would
# crash the server at startup the same way.
# (Copied after `npm ci` so patch edits don't invalidate the install layer.)
COPY patches ./patches/
RUN npx patch-package

# Run the postinstall steps we DO need, manually.
RUN npx prisma generate && npx nuxi prepare

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-bookworm-slim AS production

WORKDIR /app

# OpenSSL (Prisma) + build tools for the bcrypt rebuild / prisma generate below.
# Build tools are purged again after the rebuild to keep the image small.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and prisma config
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install production dependencies only
RUN npm ci --legacy-peer-deps --omit=dev --ignore-scripts

# Rebuild the native runtime deps we need (better-sqlite3 not needed in prod —
# Nuxt Content's runtime uses the prebuilt artifacts in /app/.output).
RUN npm rebuild bcrypt

# Generate Prisma client for production (postinstall scripts were skipped above).
# Runs inside this Debian image, so `native` resolves to debian-openssl-3.0.x.
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/.output ./.output

# Remove build tools to reduce image size (keep openssl for Prisma at runtime).
RUN apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Expose port
EXPOSE 3000

# Copy entrypoint script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Health check — use Node's global fetch (Debian slim has no busybox wget).
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run as non-root user for security
RUN chown -R node:node /app
USER node

# Start the application (runs migrations then starts server)
ENTRYPOINT ["/app/docker-entrypoint.sh"]
