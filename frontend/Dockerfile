# --- Build the static app ---
FROM node:22-alpine AS build
WORKDIR /app
# The lock files were written by npm 11; the image ships npm 10, which reads them differently.
RUN npm install -g npm@11.20.0 --no-fund --no-audit
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve it with nginx, which also proxies /api to the backend (same origin: no CORS, cookie stays first-party) ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
