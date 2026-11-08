'use strict';
// Caixa Vini — servidor (Fastify). Serve o app em /, a API em /api e o webhook do WhatsApp.
const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');
const { abrirBanco, COLECOES } = require('./db');
const { criarIA } = require('./ia');
const { whatsappPlugin, whatsappConfigurado } = require('./whatsapp');
const { processarMensagem, desfazer } = require('./financas');
const auth = require('./auth');

const ID_OK = /^[A-Za-z0-9_.:@+~-]{1,120}$/;

function criarApp({ env = process.env, store, ia, fetchImpl, logger = true } = {}) {
  if (!env.APP_SENHA) throw new Error('Defina APP_SENHA (a senha para entrar no app)');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Defina SESSION_SECRET com pelo menos 32 caracteres');
  if (!store) {
    const arquivo = env.DB_FILE || path.join(__dirname, '..', 'data', 'caixa.db');
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    store = abrirBanco(arquivo);
  }
  ia = ia || criarIA(env, fetchImpl);

  const app = Fastify({ logger, trustProxy: true, bodyLimit: 8 * 1024 * 1024 });
  const limitador = auth.criarLimitador();
  const seguro = env.NODE_ENV === 'production';

  app.register(require('@fastify/cookie'));
  app.register(require('@fastify/static'), { root: path.join(__dirname, '..', 'public'), index: ['index.html'] });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'same-origin');
    reply.header('x-frame-options', 'DENY');
    return payload;
  });

  const logado = (req) => Boolean(auth.verificar(req.cookies?.[auth.COOKIE], env.SESSION_SECRET));
  const exigirLogin = async (req, reply) => {
    if (!logado(req)) return reply.code(401).send({ error: 'Faça login para continuar' });
  };

  app.register(async (api) => {
    api.get('/status', async (req) => ({
      autenticado: logado(req),
      ia: ia.provedor,
      audio: ia.podeAudio,
      whatsapp: whatsappConfigurado(env),
    }));

    api.post('/login', async (req, reply) => {
      const ip = req.ip;
      if (limitador.bloqueado(ip)) return reply.code(429).send({ error: 'Muitas tentativas. Espere 15 minutos.' });
      if (!auth.senhaConfere(req.body?.senha, env.APP_SENHA)) {
        limitador.erro(ip);
        return reply.code(401).send({ error: 'Senha incorreta' });
      }
      limitador.limpar(ip);
      const token = auth.assinar({ exp: Date.now() + auth.DURACAO_MS }, env.SESSION_SECRET);
      reply.setCookie(auth.COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: seguro, maxAge: auth.DURACAO_MS / 1000 });
      return { ok: true };
    });

    api.post('/logout', async (req, reply) => {
      reply.clearCookie(auth.COOKIE, { path: '/' });
      return { ok: true };
    });

    api.register(async (priv) => {
      priv.addHook('preHandler', exigirLogin);

      priv.get('/estado', async () => store.estado());

      priv.put('/dados/:col/:id', async (req, reply) => {
        const { col, id } = req.params;
        if (!COLECOES.includes(col) || !ID_OK.test(id)) return reply.code(400).send({ error: 'Coleção ou id inválido' });
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return reply.code(400).send({ error: 'Corpo inválido' });
        return store.put(col, { ...req.body, id });
      });

      priv.delete('/dados/:col/:id', async (req, reply) => {
        const { col, id } = req.params;
        if (!COLECOES.includes(col) || !ID_OK.test(id)) return reply.code(400).send({ error: 'Coleção ou id inválido' });
        store.del(col, id);
        return { ok: true };
      });

      priv.put('/config', async (req, reply) => {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return reply.code(400).send({ error: 'Corpo inválido' });
        store.setConfig(req.body);
        return store.config();
      });

      // Importa um backup do app (inclusive o da versão antiga, publicada no Claude).
      priv.post('/importar', async (req, reply) => {
        const b = req.body?.backup;
        if (!b || !Array.isArray(b.contas)) return reply.code(400).send({ error: 'Backup inválido: use um arquivo exportado pelo Caixa Vini' });
        let n = 0;
        store.transacao(() => {
          for (const col of COLECOES) {
            for (const o of Array.isArray(b[col]) ? b[col] : []) {
              if (o && typeof o === 'object' && o.id && ID_OK.test(String(o.id))) { store.put(col, o); n++; }
            }
          }
          if (b.config && typeof b.config === 'object') store.setConfig(b.config);
        });
        return { ok: true, registros: n };
      });

      priv.post('/ia/mensagem', async (req, reply) => {
        const texto = String(req.body?.texto || '').slice(0, 2000);
        if (!texto.trim()) return reply.code(400).send({ error: 'Mensagem vazia' });
        return processarMensagem({ store, ia, texto, canal: 'app', log: req.log });
      });

      priv.post('/ia/desfazer', async (req) => {
        desfazer(store, Array.isArray(req.body?.feitos) ? req.body.feitos : []);
        return { ok: true };
      });
    });
  }, { prefix: '/api' });

  app.register(whatsappPlugin, { env, store, ia, fetchImpl });

  app.get('/saude', async () => ({ ok: true }));
  app.addHook('onClose', async () => store.fechar?.());
  return app;
}

if (require.main === module) {
  const app = criarApp();
  app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' }).catch((e) => { app.log.error(e); process.exit(1); });
}

module.exports = { criarApp };
