FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies like typescript and prisma)
RUN npm install

# Copy ALL source (including prisma/) up front so the final generate/build layer
# always runs against the current schema and is never served a stale cached client.
COPY . .

# Generate Prisma client (required before running with ts-node)
RUN npx prisma generate

# Run directly with ts-node — avoids memory-huge tsc compilation
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx ts-node src/index.ts"]
