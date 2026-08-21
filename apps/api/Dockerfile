# syntax=docker/dockerfile:1.7

FROM node:24.18.0-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.15.0 --activate

WORKDIR /workspace
COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter @thread/api... build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @thread/api deploy --prod --legacy /opt/thread-api

FROM node:24.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

RUN apt-get update \
    && apt-get install --no-install-recommends --yes ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node --from=build /opt/thread-api/package.json ./package.json
COPY --chown=node:node --from=build /opt/thread-api/node_modules ./node_modules
COPY --chown=node:node --from=build /opt/thread-api/dist ./dist

USER node
EXPOSE 4000

ENTRYPOINT ["tini", "--"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 4000}/health/live`).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
