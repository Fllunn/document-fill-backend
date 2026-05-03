FROM node:20.17.0-alpine AS base

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

FROM base AS build

COPY . .

RUN npm run build

FROM base AS production

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./

RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=build /app/dist ./dist

CMD ["node", "dist/main"]