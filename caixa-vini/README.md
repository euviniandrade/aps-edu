# Caixa Vini

Gestão financeira pessoal com assistente de IA e robô no WhatsApp.
É um app **separado do SOFI**: tem servidor, banco e deploy próprios, e nenhum dado passa pelo backend da APS.

- **App web** (`public/index.html`): painel, contas a pagar, extrato, orçamento, metas, plano de dívidas, cartões, calendário, relatórios e backup. Feito para celular.
- **Assistente**: você escreve (ou dita pelo teclado) "gastei 45 no mercado no pix" e ele registra. Também responde perguntas sobre seus números.
- **WhatsApp**: o mesmo assistente pela API oficial da Meta. Entende texto e áudio, e só atende o seu número.

## Como funciona

```
WhatsApp ──► Meta (Cloud API) ──► POST /webhook/whatsapp ─┐
                                                           ├─► src/financas.js ──► SQLite (/data/caixa.db)
Navegador ──► /  (app)  ──► /api/*  (login por senha) ─────┘          │
                                                                       └─► IA: Gemini ou Claude
```

| Arquivo | O que faz |
|---|---|
| `src/server.js` | Fastify: serve o app, a API e registra o webhook |
| `src/financas.js` | Regras: ler a mensagem, registrar gastos, pagar contas, desfazer, resumo |
| `src/ia.js` | Chama Gemini (`GEMINI_API_KEY`) ou Claude (`ANTHROPIC_API_KEY`). Áudio só com Gemini |
| `src/whatsapp.js` | Webhook da Meta: valida assinatura, filtra seu número, baixa áudio, responde |
| `src/db.js` | SQLite com registros em JSON (`contas`, `lancamentos`, `cartoes`, `metas`, `dividas`, `config`) |
| `src/auth.js` | Login com senha única e cookie assinado |

Sem chave de IA, um leitor simples entende frases como "gastei 45 no mercado" e "paguei a Claro". Perguntas e frases mais soltas precisam da IA.

## Rodar no computador

```bash
cd caixa-vini
npm install
cp .env.example .env      # preencha APP_SENHA e SESSION_SECRET (openssl rand -hex 32)
npm run dev               # http://localhost:3000
npm test                  # testes (node:test)
```

## Publicar no Fly.io (uma vez)

```bash
cd caixa-vini
fly apps create caixa-vini                 # se o nome estiver ocupado, troque aqui e no fly.toml
fly volumes create caixa_vini_data --region gru --size 1
fly secrets set \
  APP_SENHA='sua-senha' \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  GEMINI_API_KEY='...'
fly deploy
```

O app fica em `https://caixa-vini.fly.dev`. Depois disso, cada push na `main` que mexa em `caixa-vini/**` publica sozinho, desde que o segredo `FLY_API_TOKEN_CAIXA_VINI` exista no GitHub (`fly tokens create deploy -a caixa-vini`). Sem esse segredo, o workflow só roda os testes.

### Trazer os dados da versão antiga

Na página antiga (no Claude), abra **Mais › Backup › Copiar backup**. No app novo, abra **Mais › Backup › Colar backup** e cole.

## WhatsApp (API oficial da Meta, sem chip extra)

A Meta oferece um **número de teste gratuito** que conversa com até 5 números que você cadastrar. Para uso pessoal, basta. A conexão é oficial, então seu número pessoal não corre risco de bloqueio.

1. Entre em <https://developers.facebook.com>, vá em **Meus apps › Criar app**, escolha o tipo **Empresa** e adicione o produto **WhatsApp**.
2. Em **WhatsApp › Configuração da API**:
   - anote o **Identificador do número de telefone** → `WA_PHONE_NUMBER_ID`;
   - em **Para**, adicione o **seu número** e confirme o código que chegar;
   - anote o número de teste mostrado em **De**. Você vai conversar com ele.
3. Crie um **token permanente**. O token da tela expira em 24 h. Vá em **Configurações do negócio › Usuários do sistema**, crie um usuário Admin, atribua o app e gere um token com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`, sem expiração → `WA_TOKEN`.
4. Em **Configurações do app › Básico**, copie a **Chave secreta do app** → `WA_APP_SECRET`.
5. Configure os segredos no servidor:
   ```bash
   fly secrets set WA_TOKEN='...' WA_PHONE_NUMBER_ID='...' WA_APP_SECRET='...' \
     WA_VERIFY_TOKEN='um-texto-que-voce-inventar' WA_NUMERO_DONO='5511999999999'
   ```
6. Em **WhatsApp › Configuração › Webhook**, informe:
   - URL de callback: `https://caixa-vini.fly.dev/webhook/whatsapp`
   - Token de verificação: o mesmo `WA_VERIFY_TOKEN`
   - Depois clique em **Gerenciar** e assine o campo **messages**.
7. Mande **oi** para o número de teste. No app, em **Mais › WhatsApp**, informe o número do robô para ter um atalho que abre a conversa.

Comandos: `resumo`, `contas`, `desfazer`, `ajuda`. O resto é conversa: "uber 18", "recebi 2.500", "paguei a Claro", "luz 120 vence dia 20", "quanto posso gastar até o fim do mês?". Áudio funciona com `GEMINI_API_KEY`.

**Custos.** Pelas regras atuais da Meta, as conversas que você inicia são gratuitas, mas confira a página de preços do WhatsApp Business. As chamadas de IA são cobradas pelo Google ou pela Anthropic, conforme a chave usada. A máquina no Fly desliga sozinha quando fica parada.

**Problemas comuns**
- *O robô não responde*: rode `fly logs`. "Assinatura inválida" indica `WA_APP_SECRET` errado. "número não autorizado" indica que `WA_NUMERO_DONO` não bate com o número que mandou a mensagem.
- *Erro 131030 ao responder*: seu número não está na lista **Para** do número de teste (passo 2).
- *Parou depois de um dia*: você usou o token temporário. Gere o permanente (passo 3).

## Segurança

- Um único usuário: a senha fica em `APP_SENHA` e as tentativas erradas são limitadas por IP.
- O webhook confere a assinatura `X-Hub-Signature-256` da Meta e ignora qualquer número que não seja `WA_NUMERO_DONO`.
- Mensagens reenviadas pela Meta não são registradas duas vezes.
- Nunca commite `.env` ou o banco (`data/`, `*.db`). O `.gitignore` já cobre isso.
