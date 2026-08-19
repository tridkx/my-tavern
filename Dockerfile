# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install --no-audit --no-fund
COPY server server
COPY web web
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/web/package.json web/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
