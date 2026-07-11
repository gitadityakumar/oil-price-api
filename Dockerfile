# syntax=docker/dockerfile:1

# ── Install all deps (compile needs typescript) ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Compile TypeScript → dist/ ───────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && find dist -name '*.map' -delete

# ── Production node_modules only ─────────────────────────────────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && find node_modules -type d -empty -delete \
  && npm cache clean --force

# ── Minimal runtime image ────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

# Drop privileges; node user ships with the official image (uid 1000).
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node package.json ./

USER node

EXPOSE 8080

# Alpine node has no curl; Node 20 provides fetch.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
