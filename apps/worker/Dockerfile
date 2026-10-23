# Najimi worker: every slow job (taste profiles, image and video generation, product lookups).
# Build from the repository root:   docker build -f apps/worker/Dockerfile .
#
#   build:   install the worker's workspace, bundle its TypeScript (it and every @najimi package) to
#            JavaScript once (scripts/build.mjs), then `pnpm deploy` a production install.
#   runtime: the bundle, production node_modules and the migrations, run by `node` as PID 1.
FROM node:22.23.3-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
RUN corepack enable
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@najimi/worker..."
# The check fails the build if the flat install holds a different version of a package than the
# bundle was built against (scripts/build.mjs --check).
RUN pnpm --filter @najimi/worker build \
  && pnpm --filter @najimi/worker deploy --prod --legacy --config.node-linker=hoisted /out \
  && node apps/worker/scripts/build.mjs --check /out

FROM node:22.23.3-bookworm-slim
ENV NODE_ENV=production
# ffmpeg makes video stories phone-ready (H.264 + AAC, fast start) and takes their posters.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
# The bundle finds the migrations the way the source did (packages/db/drizzle from the repo root).
WORKDIR /app/apps/worker
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/packages/db/drizzle /app/packages/db/drizzle
COPY --from=build /app/apps/worker/samples /app/apps/worker/samples
USER node
# The heap stays under the container's limit (set in Coolify) with room for native memory.
CMD ["node", "--max-old-space-size=768", "--enable-source-maps", "--import", "./dist/bundle/register.mjs", "dist/bundle/main.mjs"]
