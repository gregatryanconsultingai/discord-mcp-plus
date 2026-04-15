# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build --chown=node:node /app/dist ./dist
ENV DISCORD_MCP_TRANSPORT=http
ENV DISCORD_MCP_HTTP_PORT=3000
EXPOSE 3000
# Required at runtime: DISCORD_TOKEN, DISCORD_MCP_HTTP_TOKEN
USER node
CMD ["node", "dist/index.js"]
