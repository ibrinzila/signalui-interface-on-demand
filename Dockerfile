FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run validate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/server.mjs ./scripts/server.mjs
EXPOSE 8080
CMD ["node", "scripts/server.mjs"]
