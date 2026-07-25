FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies like typescript and prisma)
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Ensure a clean build and avoid stale cached typings/dist from partial builds
RUN rm -rf dist .tsbuildinfo node_modules/.cache
# Build TypeScript
RUN npm run build

# Start the server
CMD ["npm", "start"]
