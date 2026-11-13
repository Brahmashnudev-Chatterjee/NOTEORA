ARG NODE_IMAGE=node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install --global npm@11.21.2
COPY gateway-api/package*.json ./gateway-api/
COPY database/prisma ./database/prisma
RUN npm ci --prefix gateway-api --ignore-scripts
COPY gateway-api/src ./gateway-api/src
COPY gateway-api/tsconfig.json ./gateway-api/tsconfig.json
COPY security ./security
RUN ln -s gateway-api/node_modules /app/node_modules \
    && PRISMA_GENERATE_SKIP_AUTOINSTALL=1 gateway-api/node_modules/.bin/prisma generate --schema database/prisma/schema.prisma --generator gateway \
    && npm --prefix gateway-api run build
RUN npm prune --prefix gateway-api --omit=dev --ignore-scripts
FROM ${NODE_IMAGE} AS runtime
USER root
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production
WORKDIR /app/gateway-api
COPY --from=build --chown=node:node /app/gateway-api/package*.json ./
COPY --from=build --chown=node:node /app/gateway-api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/gateway-api/dist ./dist
COPY --from=build --chown=node:node /app/security /app/security
RUN mkdir -p /app/gateway-api/uploads && chown node:node /app/gateway-api/uploads
USER node
EXPOSE 5100
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:5100/api/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","dist/index.js"]
