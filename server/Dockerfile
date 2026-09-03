FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Force fresh prisma generate
RUN npx prisma generate

# Build the project
RUN npm run build

# Start: regenerate prisma client (to match schema), then start server
CMD ["sh", "-c", "npx prisma generate && exec node --max-old-space-size=384 dist/src/index.js"]
