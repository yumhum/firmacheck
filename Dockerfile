# --- Build stage ---
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
# Disable pnpm 11 supply-chain age policy so the frozen lockfile installs in CI/Docker
ENV PNPM_CONFIG_MINIMUM_RELEASE_AGE=0
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# --- Runtime stage (same base ⇒ better-sqlite3 native binary is compatible) ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NUXT_DB_PATH=/app/data/firmacheck.db
ENV NITRO_PORT=3000
COPY --from=builder /app/.output ./.output
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
