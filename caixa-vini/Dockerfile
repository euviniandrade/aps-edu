FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
ENV PORT=3000 DB_FILE=/data/caixa.db
EXPOSE 3000
CMD ["node", "src/server.js"]
