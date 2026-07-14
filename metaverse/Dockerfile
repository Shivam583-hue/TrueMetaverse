# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.14-slim AS dependencies
WORKDIR /app

# Dependency metadata is copied separately so source edits reuse the install
# layer. Every workspace manifest is required for Bun to resolve the monorepo.
COPY package.json bun.lock .npmrc ./
COPY apps/http/package.json apps/http/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/ws/package.json apps/ws/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS source
COPY . .
RUN cd packages/db && bunx prisma generate

FROM source AS http
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER bun
CMD ["bun", "apps/http/index.ts"]

FROM source AS ws
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
USER bun
CMD ["bun", "apps/ws/index.ts"]

FROM source AS web-build
WORKDIR /app/apps/web
RUN bun run build

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
