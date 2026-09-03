FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript without node_modules copy cache
RUN rm -rf dist .tsbuildinfo && npm run build

EXPOSE 10000

CMD ["node", "dist/src/index.js"]
