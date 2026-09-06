FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Force Prisma client regeneration from the correct schema
RUN rm -rf node_modules/.prisma && npm run build

EXPOSE 10000

CMD ["node", "dist/src/index.js"]
