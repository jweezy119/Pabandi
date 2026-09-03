FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run migrations at build time (ensures DB schema is up-to-date)
RUN npx prisma migrate deploy

# Start server with ts-node
CMD ["sh", "-c", "exec npx ts-node src/index.ts"]
