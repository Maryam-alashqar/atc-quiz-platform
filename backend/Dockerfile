# --- Build: install everything, generate the Prisma client, compile TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app
# The lock files were written by npm 11; the image ships npm 10, which reads them differently.
RUN npm install -g npm@11.20.0 --no-fund --no-audit
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Runtime: compiled app, production dependencies (includes the Prisma CLI), migrations and sample data ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json /app/prisma7.config.ts ./
COPY --chown=node:node docker-entrypoint.sh ./
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
