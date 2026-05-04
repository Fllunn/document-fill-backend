FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

FROM base AS build

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=512"

RUN npm run build

FROM node:22-alpine AS production

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV CI=true

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 3033

CMD ["node", "dist/main.js"]