FROM node:20-slim

WORKDIR /app

COPY backend/package*.json ./

RUN apt-get update && apt-get install -y \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --omit=dev

COPY backend/ ./
COPY backend/.env.local* ./

EXPOSE 3000

CMD ["node", "src/server.js"]
