FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# ---- Server ----
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --include=dev

COPY server/ .

RUN npx prisma generate
RUN NODE_OPTIONS=--max-old-space-size=1700 npm run compile

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
