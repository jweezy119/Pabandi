FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Force fresh prisma generate (no cache)
RUN rm -rf node_modules/.prisma node_modules/.cache
RUN npx prisma generate

# Run with ts-node
CMD ["sh", "-c", "exec npx ts-node src/index.ts"]
