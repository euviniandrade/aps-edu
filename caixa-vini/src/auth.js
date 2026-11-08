'use strict';
// Sessão simples para um único dono: PIN/senha + cookie assinado com HMAC.
const crypto = require('crypto');

const COOKIE = 'cv_sessao';
const DURACAO_MS = 90 * 24 * 60 * 60 * 1000;

function assinar(payload, segredo) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', segredo).update(corpo).digest('base64url');
  return `${corpo}.${sig}`;
}

function verificar(token, segredo) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, sig] = token.split('.');
  const esperado = crypto.createHmac('sha256', segredo).update(corpo).digest('base64url');
  const a = Buffer.from(sig || ''); const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

function senhaConfere(digitada, correta) {
  const h = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest();
  return Boolean(correta) && crypto.timingSafeEqual(h(digitada), h(correta));
}

// Limite de tentativas de login por IP (memória): 8 erros a cada 15 minutos.
function criarLimitador(max = 8, janelaMs = 15 * 60 * 1000) {
  const mapa = new Map();
  return {
    bloqueado(ip) {
      const r = mapa.get(ip);
      if (!r) return false;
      if (Date.now() - r.inicio > janelaMs) { mapa.delete(ip); return false; }
      return r.n >= max;
    },
    erro(ip) {
      const r = mapa.get(ip);
      if (!r || Date.now() - r.inicio > janelaMs) mapa.set(ip, { n: 1, inicio: Date.now() });
      else r.n++;
    },
    limpar(ip) { mapa.delete(ip); },
  };
}

module.exports = { COOKIE, DURACAO_MS, assinar, verificar, senhaConfere, criarLimitador };
