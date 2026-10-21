# syntax=docker/dockerfile:1
# Next.js frontend built in separate dependency, build, and minimal runtime stages.

# ---------------------------------------------------------------------------
# deps: resolve the dependency tree once, separately from the source
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Copy manifests first so source-only changes can reuse the dependency layer.
COPY package.json package-lock.json ./

# `npm ci` enforces lockfile consistency; `--ignore-scripts` avoids running dependency lifecycle scripts during the build.
RUN npm ci --no-audit --no-fund --ignore-scripts

# ---------------------------------------------------------------------------
# builder: typecheck, lint and produce the server bundle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `NEXT_PUBLIC_*` values are baked into the browser bundle; use a browser-reachable API URL, not a Docker-only hostname.
# They are build arguments, so changing them requires rebuilding the image.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_CURRENCY=USD
ARG NEXT_PUBLIC_COMPANY_NAME="AutoFix Garage"

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY \
    NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_TELEMETRY_DISABLED=1

# Fail the build when type checking or linting fails.
RUN npm run build

# ---------------------------------------------------------------------------
# runner: node, the traced bundle, and the static files it serves from disk
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run the production server as the unprivileged `node` user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the traced server and only the runtime dependencies it needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets separately; the standalone trace excludes them.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Use the bundled curl; `--fail` treats non-2xx responses as unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]