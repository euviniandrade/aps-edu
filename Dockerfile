FROM node:20-slim

WORKDIR /app

# Copia package.json e instala
COPY backend/package*.json ./

RUN apt-get update && apt-get install -y \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --omit=dev

# Copia código
COPY backend/whatsapp-baileys.js whatsapp.js
COPY backend/.env.local* ./

# Cria pasta de dados
RUN mkdir -p /data

EXPOSE 8081

CMD ["node", "whatsapp.js"]
