FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 10000

# Use existing dist/ if present, otherwise fail fast
CMD ["node", "dist/src/index.js"]
