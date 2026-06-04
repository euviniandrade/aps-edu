# APS-EDU Desktop

Thin Electron wrapper for the APS-EDU WhatsApp CRM.

## Run

```powershell
cd "C:\Users\vinicius.felix\Projetos\aps-edu\desktop"
npm install
npm start
```

## Production URL fallback

The app tries the following URLs, in order:

1. `APS_EDU_WEB_URL`
2. `APS_EDU_DESKTOP_URL`
3. `NEXT_PUBLIC_WEB_URL`
4. `https://aps-edu.vercel.app/whatsapp`
5. `http://localhost:3001/whatsapp`

