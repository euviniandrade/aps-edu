# Como rodar o WhatsApp (backend local)

## 1. Instalar dependências (se necessário)
```bash
cd backend
npm install
```

## 2. Configurar variáveis de ambiente
Edite o arquivo `backend/.env.local` e ajuste:
```
WHATSAPP_PORT=8081
WHATSAPP_API_KEY=aps-edu-whatsapp
GEMINI_API_KEY=sua-chave-do-gemini
```

## 3. Iniciar o servidor WhatsApp
```bash
npm run whatsapp
```
Ou com reload automático em desenvolvimento:
```bash
npm run whatsapp:dev
```

O servidor sobe na **porta 8081**.

## 4. Expor via túnel (para o Vercel conseguir alcançar)
O site está no Vercel (nuvem), mas o backend WhatsApp roda no seu PC local.
Precisa de um túnel para conectar os dois.

### Opção A — Cloudflare Tunnel (grátis, sem conta)
```bash
# Instale o cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8081
```
Copie a URL gerada (ex: `https://xxxx.trycloudflare.com`)

### Opção B — ngrok (grátis com conta)
```bash
# Instale: https://ngrok.com/download
ngrok http 8081
```
Copie a URL gerada (ex: `https://xxxx.ngrok-free.app`)

## 5. Configurar a URL do túnel no Vercel
No painel do Vercel, adicione a variável de ambiente:
```
WHATSAPP_BACKEND_URL=https://SUA-URL-DO-TUNEL-AQUI
```
Depois faça um novo deploy (ou o redeploye automático do próximo push).

## 6. Acessar no site
Abra a página **WhatsApp** no site. Clique em **Conectar** e escaneie o QR Code com o seu celular.

---

## Resumo rápido
1. `npm run whatsapp` → inicia servidor local
2. `cloudflared tunnel --url http://localhost:8081` → cria túnel
3. Cole a URL do túnel como `WHATSAPP_BACKEND_URL` no Vercel
4. Push → Vercel redeploya com a nova URL
5. Escaneie o QR no site → pronto!
