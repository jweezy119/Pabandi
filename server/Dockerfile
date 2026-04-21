# Use the official Node.js 18 image.
# https://hub.docker.com/_/node
FROM node:18-bullseye-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install native dependencies required for bcrypt and tensorflow
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies.
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy local code to the container image.
COPY . .

# Build the app explicitly
RUN npm run build

# Run the web service on container startup.
ENV PORT 8080
EXPOSE 8080

CMD [ "npm", "start" ]
