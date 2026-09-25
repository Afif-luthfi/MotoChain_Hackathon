FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_TESTNET_CONTRACT
ARG VITE_MAINNET_CONTRACT
ENV VITE_TESTNET_CONTRACT=$VITE_TESTNET_CONTRACT VITE_MAINNET_CONTRACT=$VITE_MAINNET_CONTRACT
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/lib/schema.js ./src/lib/schema.js
COPY scripts/backup*.js ./scripts/
RUN mkdir /data /backups && chown node:node /data /backups
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATA_DIR=/data BACKUP_DIR=/backups
CMD ["node", "server/index.js"]
