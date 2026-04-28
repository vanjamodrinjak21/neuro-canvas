# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (bcrypt) and OpenSSL for Prisma
RUN apk add --no-cache python3 make g++ openssl openssl-dev libc6-compat

# Copy package files and prisma config
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies with all postinstall scripts skipped.
# Why: onnxruntime-node's postinstall pulls Microsoft NuGet binaries, which
# routinely time out from Railway's europe-west4 region. We don't need the
# native ONNX runtime on the server (pgvector + JS embeddings cover it).
# Why not --omit=optional: triggers npm bug #4828 that drops required
# optional native bindings like @oxc-parser/binding-linux-x64-musl.
RUN npm ci --legacy-peer-deps --ignore-scripts

# Manually rebuild the native deps we DO need (Nuxt Content uses better-sqlite3
# during `nuxt build` for the docs cache; bcrypt is used at runtime by auth).
RUN npm rebuild better-sqlite3 bcrypt

# Run the postinstall steps we DO need, manually.
RUN npx prisma generate && npx nuxi prepare

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install OpenSSL and dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl openssl-dev libc6-compat

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

# Generate Prisma client for production (postinstall scripts were skipped above)
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/.output ./.output

# Remove build tools to reduce image size (keep openssl for Prisma)
RUN apk del python3 make g++ openssl-dev

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Expose port
EXPOSE 3000

# Copy entrypoint script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run as non-root user for security
RUN chown -R node:node /app
USER node

# Start the application (runs migrations then starts server)
ENTRYPOINT ["/app/docker-entrypoint.sh"]
