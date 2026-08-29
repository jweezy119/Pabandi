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

# Ensure a clean build and avoid stale cached typings/dist from partial builds.
# Regenerate the Prisma client here (in the same non-cached layer as the build)
# so the deployed @prisma/client always matches schema.prisma (agentBooking, prepared, etc).
RUN rm -rf dist .tsbuildinfo node_modules/.prisma node_modules/.cache \
 && npx prisma generate \
 && npm run build

# Start the server
CMD ["sh", "-c", "npx prisma migrate deploy --preview-feature && npm start"]
