'use strict';
// Escolhe onde os dados ficam:
// - BLOB_READ_WRITE_TOKEN definido (Vercel): arquivo privado no Vercel Blob;
// - senão: SQLite em disco (DB_FILE), usado no Fly.io e no computador.
// Todas as rotas usam `backend.usar(async (store) => ...)`.
const path = require('path');
const fs = require('fs');
const { criarMemStore } = require('./memstore');

const CAMINHO_BLOB = 'caixa-vini/estado.json';

function backendFixo(store) {
  return { tipo: 'memoria', usar: (fn) => fn(store), fechar: () => store.fechar?.() };
}

function backendSqlite(arquivo) {
  const { abrirBanco } = require('./db');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const store = abrirBanco(arquivo);
  return { tipo: 'sqlite', usar: (fn) => fn(store), fechar: () => store.fechar() };
}

function backendBlob(token, blob = require('@vercel/blob')) {
  async function carregar() {
    const r = await blob.get(CAMINHO_BLOB, { access: 'private', useCache: false, token });
    if (!r || r.statusCode !== 200) return { dados: null, etag: null };
    const texto = await new Response(r.stream).text();
    return { dados: texto ? JSON.parse(texto) : null, etag: r.blob.etag };
  }
  async function gravar(dados, etag) {
    await blob.put(CAMINHO_BLOB, JSON.stringify(dados), {
      access: 'private', token, contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : {}),
    });
  }
  return {
    tipo: 'blob',
    // Lê, executa e grava. Se outra requisição gravou no meio (etag mudou), tenta de novo.
    async usar(fn) {
      for (let tentativa = 1; ; tentativa++) {
        const { dados, etag } = await carregar();
        const store = criarMemStore(dados);
        const resultado = await fn(store);
        if (!store.sujo) return resultado;
        try {
          await gravar(store.dados(), etag);
          return resultado;
        } catch (e) {
          const conflito = e?.name === 'BlobPreconditionFailedError' || e instanceof blob.BlobPreconditionFailedError;
          if (!conflito || tentativa >= 3) throw e;
        }
      }
    },
    fechar() {},
  };
}

function criarBackend(env = process.env) {
  if (env.BLOB_READ_WRITE_TOKEN) return backendBlob(env.BLOB_READ_WRITE_TOKEN);
  return backendSqlite(env.DB_FILE || path.join(__dirname, '..', 'data', 'caixa.db'));
}

module.exports = { criarBackend, backendFixo, backendBlob, CAMINHO_BLOB };
