FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy server package files and install production deps only
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

# Copy server source (includes prebuilt dist/)
COPY server/ .

# Build client (static files)
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --omit=dev
COPY client/ .
RUN npm run build

# Copy client build to server public
RUN cp -r dist/* /app/server/src/public/app/ 2>/dev/null || true

EXPOSE 10000

WORKDIR /app/server

CMD ["node", "dist/src/index.js"]
