ARG NODE_IMAGE=node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install --global npm@11.21.2
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ARG VITE_GATEWAY_API_URL=/gateway-api/v1
ENV VITE_GATEWAY_API_URL=${VITE_GATEWAY_API_URL}
RUN npm run build
FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
USER root
RUN apk upgrade --no-cache
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O - http://127.0.0.1:8080/healthz || exit 1
