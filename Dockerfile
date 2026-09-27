FROM node:22-bookworm-slim

WORKDIR /app

# Запасной вариант, если для better-sqlite3 понадобится сборка из исходников
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=5000

# Подходит, только если приложение действительно обращается к ./data.db
RUN ln -s /data/data.db /app/data.db

EXPOSE 5000
CMD ["node", "dist/index.cjs"]