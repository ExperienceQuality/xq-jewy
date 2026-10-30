# syntax=docker/dockerfile:1
FROM node:24-slim AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:24-slim
ENV NODE_ENV=production \
    XQ_JEWY_TRANSPORT=http \
    XQ_JEWY_HOST=0.0.0.0 \
    XQ_JEWY_PORT=8000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Listens on all interfaces inside the container; set XQ_JEWY_AUTH_TOKEN when publishing the port.
USER node
EXPOSE 8000
HEALTHCHECK CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.XQ_JEWY_PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
