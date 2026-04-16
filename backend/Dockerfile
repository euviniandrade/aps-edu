FROM node:20-alpine AS base
WORKDIR /app

# Instala dependências do sistema necessárias para Prisma
RUN apk add --no-cache openssl

# Copia manifests de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala dependências (produção apenas)
RUN npm ci --only=production

# Gera o Prisma Client
RUN npx prisma generate

# Copia o código-fonte
COPY src ./src/

# Usuário não-root por segurança
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

CMD ["node", "src/server.js"]
