'use strict';
// Armazenamento em memória com a mesma interface do SQLite (src/db.js).
// Usado na Vercel: o estado inteiro é lido de um arquivo privado no Vercel Blob,
// alterado em memória durante a requisição e gravado de volta se mudou.
const { COLECOES, CONFIG_PADRAO } = require('./db');

const MAX_VISTOS = 300;

function estadoVazio() {
  const d = { docs: {}, waVistos: [] };
  for (const c of [...COLECOES, 'config', 'sistema']) d.docs[c] = {};
  return d;
}

function criarMemStore(dados) {
  const d = dados && dados.docs ? dados : estadoVazio();
  d.docs = d.docs || {};
  d.waVistos = Array.isArray(d.waVistos) ? d.waVistos : [];
  const colecao = (col) => (d.docs[col] = d.docs[col] || {});
  const copia = (o) => JSON.parse(JSON.stringify(o));

  const store = {
    sujo: false,
    dados: () => d,
    all: (col) => Object.entries(colecao(col)).map(([id, o]) => ({ ...copia(o), id })),
    get(col, id) {
      const o = colecao(col)[String(id)];
      return o ? { ...copia(o), id: String(id) } : null;
    },
    put(col, obj) {
      const { id, ...resto } = obj;
      if (!id) throw new Error('Registro sem id');
      colecao(col)[String(id)] = copia(resto);
      store.sujo = true;
      return { ...obj };
    },
    del(col, id) {
      if (colecao(col)[String(id)] !== undefined) { delete colecao(col)[String(id)]; store.sujo = true; }
    },
    config: () => ({ ...CONFIG_PADRAO, ...(store.get('config', 'geral') || {}), id: undefined }),
    setConfig(c) {
      const { id, ...resto } = c || {};
      store.put('config', { ...CONFIG_PADRAO, ...resto, id: 'geral' });
    },
    estado() {
      const e = {};
      for (const c of COLECOES) e[c] = store.all(c);
      const cfg = store.config(); delete cfg.id;
      e.config = cfg;
      return e;
    },
    jaVisto(msgId) {
      const id = String(msgId);
      if (d.waVistos.includes(id)) return true;
      d.waVistos.push(id);
      if (d.waVistos.length > MAX_VISTOS) d.waVistos.splice(0, d.waVistos.length - MAX_VISTOS);
      store.sujo = true;
      return false;
    },
    // Em memória a requisição inteira já é atômica: grava tudo ou nada no fim.
    transacao(fn) {
      const antes = JSON.stringify(d.docs);
      try { return fn(); } catch (e) { d.docs = JSON.parse(antes); throw e; }
    },
    fechar() {},
  };
  return store;
}

module.exports = { criarMemStore, estadoVazio };
