# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root manifests
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages/ ./packages/

# Copy backend source
COPY backend/package.json ./backend/

# Install all dependencies (including workspaces)
RUN npm ci --workspace=packages/types --workspace=backend --omit=optional

# Copy backend source code and tsconfig
COPY backend/ ./backend/

# Build the packages/types first
RUN cd packages/types && npx tsc --outDir dist --declaration || true

# Build the backend
RUN npm run build --workspace=backend

# ─── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY backend/package.json ./backend/

RUN npm ci --workspace=packages/types --workspace=backend --omit=dev --omit=optional

# Copy compiled output
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

# Copy prisma schema (needed for migrations at runtime)
COPY backend/prisma ./backend/prisma

# Generate Prisma client in production image
RUN cd backend && npx prisma generate --schema=./prisma/schema.prisma

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/index.js"]
