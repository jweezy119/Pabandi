FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --include=dev

COPY . .

# Don't build during image creation — DATABASE_URL is only available at runtime
CMD ["sh", "-c", "echo 'Generating Prisma client...' && npx prisma generate && echo 'Compiling TypeScript...' && npx tsc && echo 'Pushing schema...' && npx prisma db push --accept-data-loss && echo 'Starting server...' && node dist/src/index.js"]
