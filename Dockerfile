# Base
FROM --platform=linux/amd64 node:20.12.1-alpine AS base
RUN mkdir /api && chown node:node /api
WORKDIR /api
USER node

# Dependencies
FROM base as dependencies
COPY .npmrc package*.json ./
RUN npm ci --production

# Build
FROM base AS build
COPY package*.json tsconfig*.json nest-cli.json ./
RUN npm ci
COPY src ./api
RUN npm run build

# Run
FROM base as run
ENV NODE_ENV=production
COPY --from=dependencies /api/node_modules ./node_modules
COPY --from=build /api/dist ./dist
COPY package.json ./
CMD ["npm", "run", "start:prod"]
