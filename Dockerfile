# syntax=docker/dockerfile:1.7
#
# Medusa backend. Build with a GitHub token that can read packages, passed as a
# secret so it never lands in an image layer (@tshirt-platform/shared is private):
#
#   GITHUB_TOKEN=$(gh auth token) docker compose --profile backend build backend

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=github_token \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/github_token)" > ~/.npmrc \
    && pnpm install --frozen-lockfile \
    ; status=$?; rm -f ~/.npmrc; exit $status

COPY . .
# The admin dashboard is bundled by Vite, which needs more than Node's default heap on a small builder
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

# `medusa build` writes a self-contained server (with its own package.json) to .medusa/server
COPY --from=build /app/.medusa/server ./
COPY .npmrc ./
RUN --mount=type=secret,id=github_token \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/github_token)" > ~/.npmrc \
    && pnpm install --prod --no-frozen-lockfile \
    ; status=$?; rm -f ~/.npmrc; exit $status

RUN chown -R node:node /app
USER node
EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- http://127.0.0.1:9000/health >/dev/null || exit 1

# Migrations run before the server starts, so a new image brings its schema with it
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
