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

# Install dependencies
RUN npm ci --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

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
RUN npm ci --legacy-peer-deps --omit=dev

# Generate Prisma client for production
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
