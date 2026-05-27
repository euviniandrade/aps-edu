# Oracle Cloud — Setup da VM aps-edu-whatsapp

> Região: Brazil East (sa-saopaulo-1)
> VM: aps-edu-whatsapp | Ubuntu 22.04

---

## Passo 1 — Finalizar criação da VM no Oracle Cloud

Na tela que você viu, configure:

| Campo | Valor recomendado |
|-------|-------------------|
| **Nome** | aps-edu-whatsapp ✓ (já preenchido) |
| **Compartimento** | engenhariatotalvinicius (raiz) ✓ |
| **Shape** | VM.Standard.A1.Flex (ARM — grátis!) ou VM.Standard.E2.1.Micro |
| **OCPU** | 1 (grátis até 4 OCPU total na conta) |
| **Memória** | 6 GB (ARM) ou 1 GB (E2.1.Micro) |
| **Imagem** | Ubuntu 22.04 (Canonical) |
| **SSH key** | Adicione sua chave pública (~/.ssh/id_rsa.pub) |

> **Dica:** Escolha A1.Flex ARM (grátis) se disponível — tem mais RAM para o Chromium.

Depois de criar, anote o **IP Público** da VM.

---

## Passo 2 — Abrir porta 3000 no Oracle Cloud

No Oracle Cloud Console:
1. **Networking → Virtual Cloud Networks → VCN da VM**
2. Clique na **Subnet pública**
3. Clique na **Security List**
4. **Add Ingress Rule:**
   - Source: `0.0.0.0/0`
   - Protocol: TCP
   - Destination Port: `3000`
5. Salvar

---

## Passo 3 — SSH na VM e executar o setup

```bash
# No seu terminal (Windows: use Git Bash ou PowerShell)
ssh ubuntu@<IP_PUBLICO>

# Baixar e executar o script de setup
curl -o oracle-setup.sh https://raw.githubusercontent.com/euviniandrade/aps-edu/main/backend/oracle-setup.sh
chmod +x oracle-setup.sh
./oracle-setup.sh
```

O script instala: Node.js 20, Chromium, PostgreSQL, Redis e PM2.

---

## Passo 4 — Copiar o backend para a VM

No seu computador local (Git Bash ou PowerShell):

```bash
# Clonar o projeto na VM (mais fácil)
ssh ubuntu@<IP_PUBLICO> "git clone https://github.com/euviniandrade/aps-edu.git /opt/aps-edu"
```

Ou enviar via scp:
```bash
scp -r "C:\Users\vinicius.felix\Projetos\aps-edu\backend" ubuntu@<IP_PUBLICO>:/opt/aps-edu/
```

---

## Passo 5 — Configurar variáveis de ambiente

```bash
ssh ubuntu@<IP_PUBLICO>
cd /opt/aps-edu/backend
cp .env.oracle.example .env
nano .env
```

Preencha obrigatoriamente:

```env
# Gere com: openssl rand -hex 64
JWT_SECRET=COLE_AQUI_64_BYTES_HEX
JWT_REFRESH_SECRET=COLE_OUTRO_AQUI

# Sua chave do Google Gemini (já tem no Vercel)
GEMINI_API_KEY=SUA_CHAVE_GEMINI

# URL do seu projeto Vercel (sem barra final)
CORS_ORIGIN=https://SEU_PROJETO.vercel.app
```

> Para gerar o JWT_SECRET, rode na VM: `openssl rand -hex 64`

---

## Passo 6 — Deploy do backend

```bash
# Na VM
cd /opt/aps-edu/backend
~/deploy-backend.sh
```

Verifique que está rodando:
```bash
pm2 status
curl http://localhost:3000/health
```

---

## Passo 7 — Configurar BACKEND_URL no Vercel

1. Acesse vercel.com → seu projeto aps-edu
2. **Settings → Environment Variables**
3. Adicione:
   ```
   BACKEND_URL = http://<IP_PUBLICO>:3000/api
   ```
4. **Redeploy** o projeto

---

## Passo 8 — Conectar o WhatsApp

1. Abra o painel em https://SEU_PROJETO.vercel.app/whatsapp
2. Clique em **"Conectar WhatsApp real"**
3. O QR Code aparece em até 30 segundos
4. No celular: **WhatsApp → Aparelhos Conectados → Adicionar aparelho**
5. Escaneie o QR
6. Aguarde "WhatsApp real conectado" ✅

A sessão fica **salva na VM** — não precisa escanear de novo depois de reiniciar.

---

## Comandos úteis na VM

```bash
# Ver logs em tempo real
pm2 logs aps-edu-backend

# Reiniciar
pm2 restart aps-edu-backend

# Ver status + memória
pm2 monit

# Ver QR no terminal (se quiser)
pm2 logs aps-edu-backend --lines 50

# Atualizar código (pull + redeploy)
cd /opt/aps-edu && git pull && cd backend && ~/deploy-backend.sh
```

---

## Solução de problemas

| Problema | Solução |
|----------|---------|
| QR não aparece | `pm2 logs aps-edu-backend` — verifique WHATSAPP_ENABLED=true |
| Chromium não encontrado | `which chromium-browser` — deve retornar `/usr/bin/chromium-browser` |
| Porta 3000 não acessível | Verifique Security List E `sudo ufw status` |
| "WhatsApp já conectado em outro dispositivo" | `pm2 restart aps-edu-backend` |
| DB connection failed | Verifique PostgreSQL: `sudo systemctl status postgresql` |
