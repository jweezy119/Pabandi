FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies like typescript and prisma)
RUN npm install

# Copy ALL source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run migrations at build time (before server starts)
RUN npx prisma migrate deploy || true

# Run directly with ts-node
CMD ["sh", "-c", "exec npx ts-node src/index.ts"]
