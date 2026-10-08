# syntax=docker/dockerfile:1
#
# AutoFix frontend (Next.js).
#
# Three stages, because the two things that must not meet are a compiler and a
# production server. `node_modules` here contains every devDependency — the
# TypeScript compiler, the linter, the Tailwind toolchain — none of which
# belongs on a box serving customers, and all of which would have to be audited
# on every rebuild if they did.

# ---------------------------------------------------------------------------
# deps: resolve the dependency tree once, separately from the source
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# The manifests alone pin the whole tree. Copying them before the source means
# editing a component does not re-resolve 300 packages, and it also means a
# source-only change cannot silently alter which dependencies are installed.
COPY package.json package-lock.json ./

# `npm ci` installs exactly the lockfile and fails if package.json and the
# lockfile have drifted apart, which is the property `npm install` does not have.
#
# `--ignore-scripts` is deliberate. Nothing in this dependency set needs a native
# build step, and a postinstall script is arbitrary code that would otherwise run
# during the build with network access — as well as prompting for approval on
# npm 11, which turns a non-interactive build into a hang.
RUN npm ci --no-audit --no-fund --ignore-scripts

# ---------------------------------------------------------------------------
# builder: typecheck, lint and produce the server bundle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `NEXT_PUBLIC_*` is inlined into the client bundle at build time, so these are
# build arguments rather than runtime environment. That is a property of the
# browser, not a limitation of this setup: the value has to be baked into the
# JavaScript the user's browser runs, so it cannot be read from the environment
# after the image is built. It must be an address a browser can open — not
# `http://backend:8000`, which resolves inside the Docker network and nowhere
# else.
#
# Declared as ARG so the values appear in the image history and a build log says
# what was inlined rather than leaving it to be guessed at.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_CURRENCY=USD
ARG NEXT_PUBLIC_COMPANY_NAME="AutoFix Garage"

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY \
    NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_TELEMETRY_DISABLED=1

# Fail the image, not the browser console, when the source does not typecheck or
# lint. A build that ships a type error has moved the failure from something CI
# can catch to something a user reports.
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

# `node:alpine` ships an unprivileged `node` user (uid 1000) precisely so a
# server does not have to run as root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# The trace: a minimal server.js plus only the node_modules Next determined the
# server actually needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Served off the filesystem, so the trace does not contain them.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Uses the `node` already in the image rather than installing curl into it for
# one check. `--fail` makes a non-2xx exit non-zero, which is the point: without
# it a 500 would report healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]