FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

FROM base AS build

COPY . .

RUN npm run build

FROM node:22-alpine AS production

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=build /app/dist ./dist

# файлы шаблонов (volume); владелец — непривилегированный пользователь node
RUN mkdir -p /app/storage/templates/system /app/storage/users && chown -R node:node /app/storage

USER node

EXPOSE 3033

# --liftoff-only: без оптимизирующей перекомпиляции WASM (TurboFan).
# Иначе первая конвертация в PDF после загрузки LibreOffice идёт ~80 с вместо ~1 с,
# а скорость следующих конвертаций не меняется (замер 2026-10-16)
CMD ["node", "--liftoff-only", "dist/main.js"]