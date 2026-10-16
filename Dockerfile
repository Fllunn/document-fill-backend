FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

FROM base AS build

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS production

# Официальный LibreOffice той же ветки 24.8, что была внутри прежнего WASM-конвертера:
# PDF совпадают пиксель в пиксель, в т.ч. положение печатей и подписей (сверено 2026-10-16).
# В 25.x плавающие картинки (печать в счёте) смещаются вверх. Шрифты — встроенные в сборку.
ARG LO_VERSION=24.8.7.2
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl fontconfig libnss3 libdbus-1-3 libcups2 libxinerama1 libglib2.0-0 libcairo2 libsm6 libice6 libx11-xcb1 libxml2 libxslt1.1 \
 && curl -fsSL "https://downloadarchive.documentfoundation.org/libreoffice/old/${LO_VERSION}/deb/x86_64/LibreOffice_${LO_VERSION}_Linux_x86-64_deb.tar.gz" -o /tmp/lo.tgz \
 && mkdir /tmp/lo && tar xzf /tmp/lo.tgz -C /tmp/lo --strip-components=1 \
 && dpkg -i /tmp/lo/DEBS/*.deb \
 && ln -s /opt/libreoffice${LO_VERSION%.*.*}/program/soffice /usr/local/bin/soffice \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /tmp/lo /tmp/lo.tgz /var/lib/apt/lists/* \
 && soffice --version

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=build /app/dist ./dist

# файлы шаблонов (volume); владелец — непривилегированный пользователь node
RUN mkdir -p /app/storage/templates/system /app/storage/users && chown -R node:node /app/storage

USER node

EXPOSE 3033

CMD ["node", "dist/main.js"]
