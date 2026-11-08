'use strict';
// Armazenamento em SQLite: cada registro é um documento JSON em (coleção, id).
// Mesmo modelo de dados da versão anterior do app, para a migração ser só importar o backup.

const COLECOES = ['contas', 'lancamentos', 'cartoes', 'metas', 'dividas'];
const CONFIG_PADRAO = { rendaMensal: 0, orcamentos: {}, reserva: 0 };

function abrirBanco(arquivo) {
  // Carregado só quando o SQLite é usado (na Vercel os dados ficam no Blob).
  const Database = require('better-sqlite3');
  const db = new Database(arquivo);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      col TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (col, id)
    );
    CREATE TABLE IF NOT EXISTS wa_vistos (
      id TEXT PRIMARY KEY,
      em TEXT NOT NULL
    );
  `);
  const q = {
    all: db.prepare('SELECT id, data FROM docs WHERE col = ?'),
    get: db.prepare('SELECT id, data FROM docs WHERE col = ? AND id = ?'),
    put: db.prepare(`INSERT INTO docs (col, id, data, atualizado_em) VALUES (?, ?, ?, ?)
                     ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, atualizado_em = excluded.atualizado_em`),
    del: db.prepare('DELETE FROM docs WHERE col = ? AND id = ?'),
    visto: db.prepare('INSERT OR IGNORE INTO wa_vistos (id, em) VALUES (?, ?)'),
    limparVistos: db.prepare("DELETE FROM wa_vistos WHERE em < ?"),
  };
  const linha = (r) => (r ? { ...JSON.parse(r.data), id: r.id } : null);

  const store = {
    all: (col) => q.all.all(col).map(linha),
    get: (col, id) => linha(q.get.get(col, id)),
    put(col, obj) {
      const { id, ...resto } = obj;
      if (!id) throw new Error('Registro sem id');
      q.put.run(col, String(id), JSON.stringify(resto), new Date().toISOString());
      return { ...obj };
    },
    del: (col, id) => { q.del.run(col, String(id)); },
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
    // Marca uma mensagem do WhatsApp como processada. Retorna true se já tinha sido vista (a Meta reenvia em caso de falha).
    jaVisto(msgId) {
      const r = q.visto.run(String(msgId), new Date().toISOString());
      if (Math.random() < 0.02) q.limparVistos.run(new Date(Date.now() - 7 * 864e5).toISOString());
      return r.changes === 0;
    },
    transacao: (fn) => db.transaction(fn)(),
    fechar: () => db.close(),
  };
  return store;
}

module.exports = { abrirBanco, COLECOES, CONFIG_PADRAO };
