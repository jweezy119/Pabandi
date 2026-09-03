FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client and build
RUN npx prisma generate && npm run build

# Start server with memory limit to prevent OOM
CMD ["sh", "-c", "exec node --max-old-space-size=384 dist/src/index.js"]
