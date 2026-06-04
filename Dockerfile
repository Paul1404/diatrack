# syntax=docker/dockerfile:1

# Stage 1: install all deps and build the app
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage 2: production-only dependencies
FROM oven/bun:1-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 3: runtime
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json server.js migrate.mjs ./
COPY drizzle ./drizzle

# Railway injects PORT; default to 3000 otherwise.
ENV PORT=3000
EXPOSE 3000

# Run migrations are handled by railway.toml preDeployCommand; start the server here.
CMD ["bun", "server.js"]
