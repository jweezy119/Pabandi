FROM node:20.18-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Force Prisma client regeneration from the correct schema
RUN rm -rf node_modules/.prisma && npm run build

# Run database migrations on startup with logging
CMD ["sh", "-c", "echo 'Running Prisma migrations...' && npx prisma migrate deploy && echo 'Migrations complete, starting server...' && node dist/src/index.js"]
