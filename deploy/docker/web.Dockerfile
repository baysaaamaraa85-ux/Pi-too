# syntax=docker/dockerfile:1
#
# proxy: React (PWA)-ийн build файлыг Caddy-ээр түгээж, /api, /uploads-ыг API руу дамжуулна
# (design 7, "proxy" контейнер). Build context нь репогийн root.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --workspace=@pitoo/web --workspace=@pitoo/contracts

COPY packages/contracts packages/contracts
COPY apps/web apps/web
# tsc -b && vite build (vite-plugin-pwa: sw.js, manifest.webmanifest үүсгэнэ). Вэб `/api/v1` гэж
# харьцангуй замаар дууддаг тул build-д API-ийн хаяг хэрэггүй.
RUN npm run build -w @pitoo/web

# Дараах алхам нь PWA-ийн гол файлууд build-д үүссэнийг шалгана (байхгүй бол image гарахгүй).
RUN test -f apps/web/dist/index.html \
 && test -f apps/web/dist/sw.js \
 && test -f apps/web/dist/manifest.webmanifest

FROM caddy:2-alpine
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv

# Railway PORT-ыг өгнө, API_UPSTREAM-ийг (жишээ нь api.railway.internal:3000) service-ийн хувьсагчаар тохируулна.
ENV PORT=8080
EXPOSE 8080
