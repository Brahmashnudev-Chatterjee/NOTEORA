ARG NODE_IMAGE=node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install --global npm@11.21.2
COPY server/package*.json ./server/
COPY database/prisma ./database/prisma
RUN npm ci --prefix server --ignore-scripts
COPY server/src ./server/src
COPY server/tsconfig.json ./server/tsconfig.json
COPY security ./security
RUN npm --prefix server run prisma:generate && npm --prefix server run build
RUN npm prune --prefix server --omit=dev --ignore-scripts
FROM ${NODE_IMAGE} AS runtime
USER root
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=build --chown=node:node /app/server/package*.json ./
COPY --from=build --chown=node:node /app/server/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/dist ./dist
COPY --from=build --chown=node:node /app/security /app/security
RUN mkdir -p /app/server/uploads && chown node:node /app/server/uploads
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:5000/api/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","dist/index.js"]
