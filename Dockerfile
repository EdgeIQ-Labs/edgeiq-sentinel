FROM node:20-slim AS base
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/db/package.json packages/db/
COPY packages/agent/package.json packages/agent/
COPY packages/worker/package.json packages/worker/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS build
RUN pnpm --filter @sentinel/web build
RUN pnpm --filter @sentinel/api build

FROM node:20-slim AS production
RUN npx playwright install --with-deps chromium 2>/dev/null || true
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/package.json ./packages/api/
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/agent ./packages/agent
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY --from=build /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
