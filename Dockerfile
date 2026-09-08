FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy server package files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install

# Copy server source
COPY server/ .

# Build TypeScript
RUN rm -rf dist .tsbuildinfo && npm run build

# Build client (static files)
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Copy client build to server public
RUN cp -r dist/* /app/server/src/public/app/ 2>/dev/null || true

EXPOSE 10000

WORKDIR /app/server

# Run database migrations on startup
CMD ["sh", "-c", "echo 'Running Prisma migrations...' && npx prisma migrate deploy && echo 'Migrations complete, starting server...' && node dist/src/index.js"]
