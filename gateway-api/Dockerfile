FROM node:22-alpine AS build
WORKDIR /app
COPY gateway-api/package*.json ./
RUN npm install
COPY gateway-api/src ./src
COPY gateway-api/tsconfig.json ./tsconfig.json
COPY database/prisma/schema.prisma /database/prisma/schema.prisma
RUN npm install prisma@6.19.0 @prisma/client@6.19.0 --save-exact
RUN DATABASE_URL='postgresql://unused:unused@127.0.0.1:5432/unused' npx prisma generate --schema /database/prisma/schema.prisma
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 5100
CMD ["node","dist/index.js"]
