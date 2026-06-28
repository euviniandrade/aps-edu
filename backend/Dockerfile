FROM node:20-alpine AS base
WORKDIR /app

# Instala dependências do sistema necessárias para Prisma
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    freetype \
    harfbuzz \
    nss \
    openssl \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copia manifests de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala dependências (produção apenas)
RUN npm install --only=production

# Gera o Prisma Client
RUN npx prisma generate

# Copia o código-fonte
COPY src ./src/

# Cria pasta de uploads e configura permissões
RUN mkdir -p /app/uploads /app/.wwebjs_auth /data

# Usuário não-root por segurança
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app /data
USER nodejs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && if [ \"$SEED_ON_STARTUP\" = \"true\" ]; then node src/prisma/seed.js; fi && node src/server.js"]
