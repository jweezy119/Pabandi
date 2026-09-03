FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
RUN npm install -g prisma

# Download fresh code from GitHub (bypasses Docker layer cache)
ARG COMMIT_SHA=main
RUN git clone https://github.com/jweezy119/Pabandi.git /tmp/pabandi \
    && cd /tmp/pabandi/server \
    && git checkout ${COMMIT_SHA} \
    && npm install \
    && npx prisma generate \
    && npm run build \
    && cp -r dist /app/ \
    && cp -r node_modules /app/ \
    && rm -rf /tmp/pabandi

EXPOSE 10000

CMD ["node", "dist/src/index.js"]
