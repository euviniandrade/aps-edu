# APS EDU — App Mobile (Capacitor)

Este app usa Capacitor para empacotar o web app hospedado no Vercel
em um app nativo para Android e iOS.

## Pré-requisitos

- Node.js 18+
- Android Studio (para Android)
- Xcode 15+ (para iOS — precisa de Mac)
- Conta Google Play Developer ($25 taxa única)
- Conta Apple Developer ($99/ano)

## Setup inicial

```bash
cd mobile
npm install
```

## Android (Google Play)

```bash
# Adiciona plataforma Android
npm run cap:android

# Abre no Android Studio
npm run cap:open:android
```

No Android Studio:
1. Build → Generate Signed Bundle/APK
2. Selecione "Android App Bundle" (.aab) para Play Store
3. Crie ou use um keystore existente
4. Build em modo Release

## iOS (App Store)

```bash
# Adiciona plataforma iOS (precisa de Mac com Xcode)
npm run cap:ios

# Abre no Xcode
npm run cap:open:ios
```

No Xcode:
1. Selecione seu Apple Developer Team
2. Product → Archive
3. Distribute App → App Store Connect

## Atualizar o app

Quando o Vercel tiver uma nova versão, o app mobile busca automaticamente
(pois carrega a URL do Vercel). Só é necessário publicar nova versão
na loja se mudar configurações nativas (ícone, splash, permissões).

## App ID
`br.edu.adventista.apssul`
