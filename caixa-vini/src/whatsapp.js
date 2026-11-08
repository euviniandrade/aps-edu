'use strict';
// Robô do WhatsApp via API oficial da Meta (WhatsApp Cloud API).
// A Meta chama POST /webhook/whatsapp a cada mensagem. Processamos e só então respondemos 200,
// porque em funções serverless (Vercel) nada roda depois da resposta.
const crypto = require('crypto');
const { processarMensagem } = require('./financas');

const so = (s) => String(s || '').replace(/\D/g, '');

// Compara números de WhatsApp. No Brasil a Meta às vezes entrega o número sem o 9º dígito,
// então para números +55 comparamos DDD + últimos 8 dígitos.
function mesmoNumero(a, b) {
  const x = so(a), y = so(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.startsWith('55') && y.startsWith('55')) return x.slice(2, 4) === y.slice(2, 4) && x.slice(-8) === y.slice(-8);
  return false;
}

function assinaturaValida(corpo, cabecalho, segredo) {
  if (!segredo || !cabecalho || !corpo) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', segredo).update(corpo).digest('hex');
  const a = Buffer.from(String(cabecalho)); const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function whatsappConfigurado(env) {
  return Boolean(env.WA_TOKEN && env.WA_PHONE_NUMBER_ID && env.WA_APP_SECRET && env.WA_VERIFY_TOKEN && env.WA_NUMERO_DONO);
}

function whatsappPlugin(fastify, opts, done) {
  const { env, usar, ia, fetchImpl = globalThis.fetch } = opts;
  const versao = env.WA_GRAPH_VERSION || 'v21.0';
  const graph = `https://graph.facebook.com/${versao}`;
  const configurado = whatsappConfigurado(env);
  const log = fastify.log;

  // Guarda o corpo cru para validar a assinatura da Meta (só neste plugin).
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, feito) => {
    req.rawBody = body;
    try { feito(null, body ? JSON.parse(body) : {}); } catch (e) { e.statusCode = 400; feito(e); }
  });

  async function enviar(para, texto) {
    const r = await fetchImpl(`${graph}/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: String(texto).slice(0, 4000), preview_url: false } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) log.error({ status: r.status, corpo: (await r.text()).slice(0, 500) }, 'WhatsApp: falha ao enviar resposta');
  }

  async function baixarMidia(mediaId) {
    const meta = await fetchImpl(`${graph}/${mediaId}`, { headers: { authorization: `Bearer ${env.WA_TOKEN}` }, signal: AbortSignal.timeout(20000) });
    if (!meta.ok) throw new Error(`mídia ${meta.status}`);
    const { url, mime_type: mime } = await meta.json();
    const arq = await fetchImpl(url, { headers: { authorization: `Bearer ${env.WA_TOKEN}` }, signal: AbortSignal.timeout(30000) });
    if (!arq.ok) throw new Error(`download ${arq.status}`);
    return { buffer: Buffer.from(await arq.arrayBuffer()), mime };
  }

  async function tratar(msg) {
    if (!msg?.id) return;
    if (!mesmoNumero(msg.from, env.WA_NUMERO_DONO)) { log.warn({ de: msg.from }, 'WhatsApp: mensagem de número não autorizado ignorada'); return; }
    let texto = '';
    let prefixo = '';
    if (msg.type === 'text') texto = msg.text?.body || '';
    else if (msg.type === 'audio') {
      if (!ia?.podeAudio) { await enviar(msg.from, '🎙️ Para eu entender áudio, configure a GEMINI_API_KEY no servidor. Por enquanto, mande por texto.'); return; }
      try {
        const { buffer, mime } = await baixarMidia(msg.audio.id);
        texto = await ia.transcrever(buffer, mime);
        prefixo = `🎙️ Entendi: "${texto}"\n\n`;
      } catch (e) {
        log.error({ err: e.message }, 'WhatsApp: falha no áudio');
        await enviar(msg.from, 'Não consegui ouvir esse áudio. Tente de novo ou mande por texto.');
        return;
      }
    } else if (msg.type === 'button' || msg.type === 'interactive') {
      texto = msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
    } else {
      await enviar(msg.from, 'Por enquanto eu entendo texto e áudio. Mande "ajuda" para ver exemplos.');
      return;
    }
    if (!texto.trim()) return;
    // Marca a mensagem como vista e processa na mesma gravação (a Meta reenvia se demorarmos).
    const r = await usar(async (store) => {
      if (store.jaVisto(msg.id)) return null;
      return processarMensagem({ store, ia, texto, canal: 'whatsapp', log });
    });
    if (r) await enviar(msg.from, prefixo + r.resposta);
  }

  // Verificação do webhook (feita uma vez pela Meta ao configurar).
  fastify.get('/webhook/whatsapp', async (req, reply) => {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && env.WA_VERIFY_TOKEN && q['hub.verify_token'] === env.WA_VERIFY_TOKEN) {
      return reply.type('text/plain').send(String(q['hub.challenge'] || ''));
    }
    return reply.code(403).send({ error: 'Token de verificação inválido' });
  });

  fastify.post('/webhook/whatsapp', async (req, reply) => {
    if (!configurado) return reply.code(503).send({ error: 'WhatsApp não configurado no servidor' });
    if (!assinaturaValida(req.rawBody, req.headers['x-hub-signature-256'], env.WA_APP_SECRET)) {
      return reply.code(401).send({ error: 'Assinatura inválida' });
    }
    const mensagens = [];
    for (const e of req.body?.entry || []) for (const c of e.changes || []) for (const m of c.value?.messages || []) mensagens.push(m);
    for (const m of mensagens) {
      try { await tratar(m); } catch (e) { log.error({ err: e.message }, 'WhatsApp: erro ao processar mensagem'); }
    }
    return { ok: true };
  });

  done();
}

module.exports = { whatsappPlugin, whatsappConfigurado, assinaturaValida, mesmoNumero };
