# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root manifests
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages/ ./packages/

# Copy frontend source
COPY frontend/package.json ./frontend/

# Install dependencies — omit optional to skip platform-specific binaries
# (e.g. @next/swc-win32-x64-msvc would fail on Linux)
RUN npm ci --workspace=packages/types --workspace=frontend --omit=optional

# Copy all source files
COPY frontend/ ./frontend/

# Build Next.js app
# NEXT_PUBLIC_API_URL must be set at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=frontend
# Ensure public dir exists (project may not have one — COPY will fail otherwise)
RUN mkdir -p ./frontend/public

# ─── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only what Next.js needs to run in standalone mode
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static

# Copy public assets (directory guaranteed to exist from builder)
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000

CMD ["node", "frontend/server.js"]
