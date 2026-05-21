# Setup — Google Apps Script Backend

## 1. Criar a planilha Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma nova planilha
2. Renomeie para **"APS EDU — Banco de Dados"**
3. Anote o **ID da planilha** (está na URL: `docs.google.com/spreadsheets/d/**ID_AQUI**/edit`)

## 2. Criar o Apps Script

1. Na planilha, clique em **Extensões → Apps Script**
2. Apague todo o código da aba `Code.gs`
3. Cole o conteúdo do arquivo `apps-script/Code.js` deste repositório
4. Salve com **Ctrl+S**

## 3. Configurar propriedades do script

1. No Apps Script, clique em **Projeto → Propriedades do projeto**
   (ícone de engrenagem ⚙️ → "Propriedades do script")
2. Em **Propriedades do script**, adicione:
   - `SPREADSHEET_ID` → ID da planilha do passo 1
   - `GEMINI_API_KEY` → sua chave do Google AI Studio (aistudio.google.com)
   - `PWD_SALT` → qualquer string aleatória (ex: `aps_edu_sul_2025_secret`)

## 4. Inicializar a planilha (uma vez só)

1. No editor do Apps Script, selecione a função `setupSpreadsheet` no menu dropdown
2. Clique em **▶ Executar**
3. Autorize as permissões quando solicitado
4. Verifique o log — deve mostrar "🎉 Setup completo! Login: admin@aps.edu.br / admin123"

## 5. Fazer o deploy como Web App

1. Clique em **Implantar → Nova implantação**
2. Clique em ⚙️ → **Aplicativo da Web**
3. Configure:
   - **Descrição**: APS EDU API v1
   - **Executar como**: Eu (sua conta Google)
   - **Quem tem acesso**: Qualquer pessoa
4. Clique em **Implantar**
5. Copie a **URL do aplicativo da Web** (parece `https://script.google.com/macros/s/ABC.../exec`)

## 6. Configurar no Vercel

1. No dashboard do Vercel, vá em **Settings → Environment Variables**
2. Adicione:
   - Nome: `APPS_SCRIPT_URL`
   - Valor: URL copiada no passo 5
3. Faça um novo deploy (ou aguarde o próximo push)

## Credenciais iniciais

```
Email: admin@aps.edu.br
Senha: admin123
```

⚠️ Troque a senha após o primeiro login!

## Atualizar o backend

Quando precisar atualizar o Apps Script:
1. Copie o novo conteúdo de `apps-script/Code.js`
2. Cole no editor do Apps Script
3. Clique em **Implantar → Gerenciar implantações**
4. Edite a implantação existente → **Nova versão** → **Implantar**
5. A URL permanece a mesma.
