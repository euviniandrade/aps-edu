# APS EDU — Sistema de Gestão Educacional

> Departamento de Educação | Associação Paulista Sul

## Estrutura do Projeto

```
aps-edu/
  backend/      → API REST (Node.js + Fastify + Prisma + PostgreSQL)
  mobile/       → App iOS/Android (Flutter)
  web-admin/    → Painel administrativo (Next.js)
```

## Pré-requisitos (instalar antes)

| Ferramenta | Download | Versão mínima |
|---|---|---|
| Node.js | https://nodejs.org (LTS) | 20.x |
| Flutter | https://flutter.dev/docs/get-started/install | 3.x |
| Docker Desktop | https://www.docker.com/products/docker-desktop | 4.x |
| Git | já instalado | — |

## Início Rápido

### 1. Iniciar banco de dados local
```bash
cd aps-edu
docker-compose up -d
```

### 2. Iniciar o backend
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### 3. Iniciar o painel web
```bash
cd web-admin
npm install
npm run dev
```

### 4. Rodar o app mobile
```bash
cd mobile
flutter pub get
flutter run
```

## URLs Locais

- **API:** http://localhost:3000
- **Painel Web:** http://localhost:3001
- **Documentação API:** http://localhost:3000/docs

## Credenciais Padrão (desenvolvimento)

| Usuário | Email | Senha | Função |
|---|---|---|---|
| Admin | admin@aps.edu.br | Admin@123 | Administrador |
| Diretor | diretor@aps.edu.br | Diretor@123 | Diretor |
| Coord. | coord@aps.edu.br | Coord@123 | Coordenador |
