'use strict';
// Caixa Vini — servidor (Fastify). Serve o app em /, a API em /api e o webhook do WhatsApp.
// Roda como processo normal (Fly.io / computador) ou como função da Vercel (api/index.js).
const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');
const { COLECOES } = require('./db');
const { criarIA } = require('./ia');
const { criarBackend, backendFixo } = require('./backend');
const { whatsappPlugin, whatsappConfigurado } = require('./whatsapp');
const { processarMensagem, desfazer } = require('./financas');
const auth = require('./auth');

const ID_OK = /^[A-Za-z0-9_.:@+~-]{1,120}$/;
const PUBLICO = path.join(__dirname, '..', 'public');

function criarApp({ env = process.env, store, backend, ia, fetchImpl, logger = true } = {}) {
  if (!env.APP_SENHA) throw new Error('Defina APP_SENHA (a senha para entrar no app)');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Defina SESSION_SECRET com pelo menos 32 caracteres');
  backend = backend || (store ? backendFixo(store) : criarBackend(env));
  ia = ia || criarIA(env, fetchImpl);
  const usar = backend.usar;

  const app = Fastify({ logger, trustProxy: true, bodyLimit: 8 * 1024 * 1024 });
  const limitador = auth.criarLimitador();
  const seguro = env.NODE_ENV === 'production' || Boolean(env.VERCEL);

  app.register(require('@fastify/cookie'));
  // Na Vercel o app (public/) é servido como arquivo estático; aqui só se a pasta existir.
  if (fs.existsSync(PUBLICO)) app.register(require('@fastify/static'), { root: PUBLICO, index: ['index.html'] });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'same-origin');
    reply.header('x-frame-options', 'DENY');
    if (req.url.startsWith('/api/')) reply.header('cache-control', 'no-store');
    return payload;
  });

  const logado = (req) => Boolean(auth.verificar(req.cookies?.[auth.COOKIE], env.SESSION_SECRET));
  const exigirLogin = async (req, reply) => {
    if (!logado(req)) return reply.code(401).send({ error: 'Faça login para continuar' });
  };
  const corpoObjeto = (b) => b && typeof b === 'object' && !Array.isArray(b);

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

      priv.get('/estado', async () => usar((s) => s.estado()));

      priv.put('/dados/:col/:id', async (req, reply) => {
        const { col, id } = req.params;
        if (!COLECOES.includes(col) || !ID_OK.test(id)) return reply.code(400).send({ error: 'Coleção ou id inválido' });
        if (!corpoObjeto(req.body)) return reply.code(400).send({ error: 'Corpo inválido' });
        return usar((s) => s.put(col, { ...req.body, id }));
      });

      priv.delete('/dados/:col/:id', async (req, reply) => {
        const { col, id } = req.params;
        if (!COLECOES.includes(col) || !ID_OK.test(id)) return reply.code(400).send({ error: 'Coleção ou id inválido' });
        await usar((s) => s.del(col, id));
        return { ok: true };
      });

      priv.put('/config', async (req, reply) => {
        if (!corpoObjeto(req.body)) return reply.code(400).send({ error: 'Corpo inválido' });
        return usar((s) => { s.setConfig(req.body); return s.config(); });
      });

      // Importa um backup do app (inclusive o da versão antiga, publicada no Claude).
      priv.post('/importar', async (req, reply) => {
        const b = req.body?.backup;
        if (!b || !Array.isArray(b.contas)) return reply.code(400).send({ error: 'Backup inválido: use um arquivo exportado pelo Caixa Vini' });
        const n = await usar((s) => s.transacao(() => {
          let total = 0;
          for (const col of COLECOES) {
            for (const o of Array.isArray(b[col]) ? b[col] : []) {
              if (corpoObjeto(o) && o.id && ID_OK.test(String(o.id))) { s.put(col, o); total++; }
            }
          }
          if (corpoObjeto(b.config)) s.setConfig(b.config);
          return total;
        }));
        return { ok: true, registros: n };
      });

      priv.post('/ia/mensagem', async (req, reply) => {
        const texto = String(req.body?.texto || '').slice(0, 2000);
        if (!texto.trim()) return reply.code(400).send({ error: 'Mensagem vazia' });
        return usar((s) => processarMensagem({ store: s, ia, texto, canal: 'app', log: req.log }));
      });

      priv.post('/ia/desfazer', async (req) => {
        await usar((s) => desfazer(s, Array.isArray(req.body?.feitos) ? req.body.feitos : []));
        return { ok: true };
      });
    });
  }, { prefix: '/api' });

  app.register(whatsappPlugin, { env, usar, ia, fetchImpl });

  app.get('/saude', async () => ({ ok: true, armazenamento: backend.tipo }));
  app.addHook('onClose', async () => backend.fechar?.());
  return app;
}

if (require.main === module) {
  const app = criarApp();
  app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' }).catch((e) => { app.log.error(e); process.exit(1); });
}

module.exports = { criarApp };
