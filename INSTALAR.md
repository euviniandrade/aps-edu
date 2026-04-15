# Guia de Instalação — APS EDU

## PASSO 1 — Instalar ferramentas necessárias

### Node.js (backend + web admin)
1. Acesse: https://nodejs.org
2. Baixe a versão **LTS** (ex: 20.x)
3. Execute o instalador
4. Verifique: abra o Terminal e digite `node --version`

### Docker Desktop (banco de dados)
1. Acesse: https://www.docker.com/products/docker-desktop
2. Baixe e instale o Docker Desktop para Windows
3. Inicie o Docker Desktop (pode levar alguns minutos na primeira vez)

### Flutter (app mobile)
1. Acesse: https://flutter.dev/docs/get-started/install/windows
2. Baixe o SDK do Flutter
3. Extraia em `C:\flutter`
4. Adicione `C:\flutter\bin` ao PATH do Windows
5. Verifique: `flutter doctor`

---

## PASSO 2 — Iniciar o banco de dados

Abra um Terminal na pasta `aps-edu` e execute:

```bash
docker-compose up -d
```

Isso inicia o PostgreSQL e Redis automaticamente.

Verifique em: http://localhost:8080 (Adminer — visualizador do banco)
- Servidor: postgres
- Usuário: aps_user
- Senha: aps_password
- Banco: aps_edu

---

## PASSO 3 — Iniciar o Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
node src/prisma/seed.js
npm run dev
```

A API estará disponível em: http://localhost:3000
Documentação: http://localhost:3000/docs

---

## PASSO 4 — Iniciar o Painel Web Admin

Em outro terminal:

```bash
cd web-admin
npm install
npm run dev
```

Painel disponível em: http://localhost:3001

Login:
- Email: admin@aps.edu.br
- Senha: Admin@123

---

## PASSO 5 — Rodar o App Mobile

```bash
cd mobile
flutter pub get
flutter run
```

> Para rodar no emulador Android: abra o Android Studio, crie um AVD (emulador) e inicie-o antes de rodar `flutter run`.
> Para iOS (somente Mac): configure o Xcode.

---

## Credenciais padrão

| Usuário | Email | Senha |
|---|---|---|
| Administrador | admin@aps.edu.br | Admin@123 |
| Diretor | diretor@aps.edu.br | Diretor@123 |
| Coordenadora | coord@aps.edu.br | Coord@123 |

---

## Estrutura de pastas

```
aps-edu/
├── backend/          ← API (Node.js + Fastify + Prisma)
│   ├── src/
│   │   ├── modules/  ← auth, tasks, events, gamification...
│   │   ├── shared/   ← middleware, config
│   │   └── prisma/   ← seed.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── .env
├── mobile/           ← App Flutter (iOS + Android)
│   └── lib/
│       ├── core/     ← api, router, theme
│       ├── features/ ← telas
│       └── shared/   ← widgets
├── web-admin/        ← Painel Next.js
│   └── src/
│       ├── app/      ← páginas
│       ├── components/
│       └── lib/      ← api client
└── docker-compose.yml
```

---

## Portas utilizadas

| Serviço | Porta |
|---|---|
| API Backend | 3000 |
| Painel Web | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Adminer (DB viewer) | 8080 |
