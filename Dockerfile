# syntax=docker/dockerfile:1

# ---- Stage 1: build the static bundle ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build.
COPY . .
ARG VITE_TIANDITU_KEY
ARG VITE_AMAP_KEY
ARG VITE_AMAP_SERVICE_HOST
ENV VITE_AMAP_SERVICE_HOST=${VITE_AMAP_SERVICE_HOST:-/_AMapService}
RUN npm run build

# ---- Stage 2: serve the bundle with Nginx ----
FROM nginx:1.27-alpine AS runtime

# Replace the default site with our SPA configuration.
RUN rm -rf /usr/share/nginx/html/*
ENV NGINX_ENVSUBST_FILTER=AMAP_SECURITY_JS_CODE
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
