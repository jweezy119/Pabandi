FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# ---- Server ----
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ .
# dist/ is prebuilt from a6b0aba64 — add invoicePublic route at runtime
COPY server/docker-patch.js ./
RUN node docker-patch.js && echo "Invoice public route injected"

# ---- Client ----
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --include=dev
COPY client/ .
RUN npm run build

RUN mkdir -p /app/server/src/public/app && cp -r /app/client/dist/* /app/server/src/public/app/

EXPOSE 10000

WORKDIR /app/server

CMD ["node", "dist/src/index.js"]
