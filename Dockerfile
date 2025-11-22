# Production Dockerfile for Cloud Run
# Combines client (React) and server (Express) into a single container

FROM node:20-alpine AS base
RUN apk add --no-cache ffmpeg openssl python3 py3-pip make g++
RUN pip3 install --break-system-packages edge-tts

# Build shared package first
FROM base AS shared-builder
WORKDIR /app/shared
COPY shared/package*.json ./
COPY shared/tsconfig.json ./
RUN npm install
COPY shared/src ./src
RUN npm run build || true

# Build client
FROM base AS client-builder
WORKDIR /app

# Copy root package.json for workspace setup
COPY package*.json ./

# Copy shared package
COPY --from=shared-builder /app/shared ./shared

# Copy client files
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

# Copy client source and build
COPY client/ ./
# Set API URL to empty string so it uses relative URLs (same origin)
ENV VITE_API_URL=""
# Cache busting: this ARG changes with each build to force rebuild
ARG CACHE_BUST=unknown
RUN echo "Build timestamp: $CACHE_BUST" && npm run build

# Build server
FROM base AS server-builder
WORKDIR /app

# Copy root package.json for workspace
COPY package*.json ./

# Copy shared package
COPY --from=shared-builder /app/shared ./shared

# Copy server files
WORKDIR /app/server
COPY server/package*.json ./
COPY server/tsconfig*.json ./
RUN npm install

# Copy server source
COPY server/src ./src
COPY server/prisma ./prisma

# Generate Prisma client and build TypeScript
RUN npx prisma generate
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Install production dependencies for server
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy Prisma schema and generate client in production
COPY server/prisma ./prisma
RUN npx prisma generate

# Copy Google Cloud credentials
COPY server/gcloud-key.json ./gcloud-key.json

# Copy built server and shared modules
COPY --from=server-builder /app/server/dist ./dist

# Copy built client files to be served by Express
COPY --from=client-builder /app/client/dist ./public/client

# Create empty public directory for uploads (will use GCS in production)
RUN mkdir -p ./public

# Set environment
ENV NODE_ENV=production

# Cloud Run sets PORT automatically
ENV PORT=8080

# Expose port (Cloud Run ignores this but good for documentation)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server
CMD sh -c "npx prisma migrate deploy && node dist/index.js"
