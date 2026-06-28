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

## PASSO 5 — Configurar o Android SDK (necessário na 1ª vez)

O Flutter precisa do Android SDK. A forma mais fácil é instalar o **Android Studio**:
1. Acesse: https://developer.android.com/studio
2. Instale o Android Studio
3. Abra-o → SDK Manager → instale o **Android SDK Platform 34**
4. No Terminal: `flutter doctor` — siga as instruções para aceitar licenças:
   ```bash
   flutter doctor --android-licenses
   ```

---

## PASSO 6 — Rodar o App Mobile

```bash
cd mobile
flutter pub get
flutter run
```

> **Emulador Android**: Abra o Android Studio → Device Manager → crie e inicie um emulador AVD, depois rode `flutter run`.
> **Dispositivo físico**: Ative "Opções do desenvolvedor" e "Depuração USB" no Android, conecte o cabo.
> **iOS** (somente Mac): Configure o Xcode e rode `cd ios && pod install` antes de `flutter run`.

### Push Notifications (Firebase) — opcional

Para ativar notificações push:
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Registre o app Android com o pacote `com.aps.edu.aps_edu`
3. Baixe o `google-services.json` e coloque em `mobile/android/app/`
4. Para iOS: baixe `GoogleService-Info.plist` e coloque em `mobile/ios/Runner/`
5. No backend, defina as variáveis `FIREBASE_*` no arquivo `.env`

> Sem o Firebase configurado, o app funciona normalmente — só as notificações push serão desabilitadas.

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
