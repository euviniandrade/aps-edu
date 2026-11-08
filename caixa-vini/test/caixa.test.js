'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { abrirBanco } = require('../src/db');
const f = require('../src/financas');
const { criarApp } = require('../src/server');
const { mesmoNumero, assinaturaValida } = require('../src/whatsapp');

const HOJE = '2026-11-07';
const novoStore = () => abrirBanco(':memory:');
const semIA = { provedor: null, podeAudio: false };

test('leitor simples entende gastos, entradas e datas relativas', () => {
  const a = f.parseLocal('gastei 45,90 no mercado ontem no débito', HOJE).acoes[0];
  assert.deepEqual([a.tipo, a.valor, a.data, a.categoria, a.metodo], ['despesa', 45.9, '2026-11-06', 'Alimentação', 'Débito']);
  assert.equal(f.parseLocal('Uber 18 agora', HOJE).acoes[0].descricao, 'Uber');
  const r = f.parseLocal('recebi 2.500 de salário', HOJE).acoes[0];
  assert.deepEqual([r.tipo, r.valor, r.categoria], ['receita', 2500, 'Salário']);
  assert.equal(f.parseLocal('1,5 mil aluguel', HOJE).acoes[0].valor, 1500);
  assert.equal(f.parseLocal('quanto posso gastar?', HOJE).acoes.length, 0);
});

test('pagar conta mensal parcelada gera a próxima parcela e desfazer volta tudo', () => {
  const s = novoStore();
  s.put('contas', { id: 'emp', nome: 'Empréstimo', valor: 90.99, vencimento: '2026-11-09', categoria: 'Empréstimos', recorrencia: 'mensal', parcelaAtual: 1, parcelaTotal: 6, status: 'aberta' });
  const acoes = f.normalizarAcoes([{ tipo: 'pagar', contaId: 'emp', data: HOJE }], s, HOJE);
  assert.equal(acoes[0].valor, 90.99);
  const feitos = f.executarAcoes(s, acoes, 'teste');
  const contas = s.all('contas');
  assert.equal(contas.length, 2);
  const prox = contas.find((c) => c.id !== 'emp');
  assert.deepEqual([prox.vencimento, prox.parcelaAtual, prox.status], ['2026-12-09', 2, 'aberta']);
  assert.equal(s.get('contas', 'emp').status, 'paga');
  assert.equal(s.all('lancamentos').length, 1);
  f.desfazer(s, feitos);
  assert.equal(s.all('contas').length, 1);
  assert.equal(s.get('contas', 'emp').status, 'aberta');
  assert.equal(s.all('lancamentos').length, 0);
});

test('última parcela não gera nova conta; fim de mês respeita meses curtos', () => {
  const s = novoStore();
  s.put('contas', { id: 'u', nome: 'X', valor: 10, vencimento: '2026-01-31', categoria: 'Outros', recorrencia: 'mensal', parcelaAtual: 6, parcelaTotal: 6, status: 'aberta' });
  f.pagarConta(s, s.get('contas', 'u'), 10, '2026-01-31');
  assert.equal(s.all('contas').length, 1);
  assert.equal(f.addMeses('2026-01-31', 1), '2026-02-28');
});

test('normalizarAcoes descarta valores inválidos e corrige categorias', () => {
  const s = novoStore();
  const a = f.normalizarAcoes([
    { tipo: 'despesa', descricao: 'x', valor: 0 },
    { tipo: 'despesa', descricao: 'Pão', valor: '7,5', categoria: 'Inventada', data: 'ontem' },
    { tipo: 'pagar', contaId: 'nao-existe' },
  ], s, HOJE);
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].valor, a[0].categoria, a[0].data, a[0].metodo], [7.5, 'Outros', HOJE, 'Pix']);
});

test('WhatsApp: comandos resumo e desfazer', async () => {
  const s = novoStore();
  s.put('contas', { id: 'claro', nome: 'Claro', valor: 94.2, vencimento: '2026-11-08', categoria: 'Contas da casa', status: 'aberta' });
  const r1 = await f.processarMensagem({ store: s, ia: semIA, texto: 'gastei 20 na padaria', canal: 'whatsapp', hoje: HOJE });
  assert.match(r1.resposta, /Registrado/);
  assert.equal(s.all('lancamentos').length, 1);
  const r2 = await f.processarMensagem({ store: s, ia: semIA, texto: 'Desfazer', canal: 'whatsapp', hoje: HOJE });
  assert.match(r2.resposta, /Desfeito/);
  assert.equal(s.all('lancamentos').length, 0);
  const r3 = await f.processarMensagem({ store: s, ia: semIA, texto: 'resumo', canal: 'whatsapp', hoje: HOJE });
  assert.match(r3.resposta, /Falta pagar: \*R\$ 94,20\*/);
  const r4 = await f.processarMensagem({ store: s, ia: semIA, texto: 'Paguei a Claro', canal: 'whatsapp', hoje: HOJE });
  assert.match(r4.resposta, /Marcada como paga: R\$ 94,20 — Claro/);
  assert.equal(s.get('contas', 'claro').status, 'paga');
});

test('IA: usa as ações devolvidas e cai no leitor simples se falhar', async () => {
  const s = novoStore();
  const iaOk = { provedor: 'teste', json: async () => ({ acoes: [{ tipo: 'conta', nome: 'Luz', valor: 120, vencimento: '2026-11-20', categoria: 'Contas da casa' }], resposta: 'Anotei a conta de luz.' }) };
  const r = await f.processarMensagem({ store: s, ia: iaOk, texto: 'luz 120 vence dia 20', hoje: HOJE });
  assert.equal(r.resposta, 'Anotei a conta de luz.');
  assert.equal(s.all('contas')[0].vencimento, '2026-11-20');
  const iaFalha = { provedor: 'teste', json: async () => { throw new Error('fora do ar'); } };
  const r2 = await f.processarMensagem({ store: s, ia: iaFalha, texto: 'gastei 10 no café', hoje: HOJE, log: { warn() {} } });
  assert.equal(r2.acoes[0].categoria, 'Alimentação');
});

test('mesmoNumero lida com o 9º dígito do Brasil', () => {
  assert.ok(mesmoNumero('5511987654321', '+55 (11) 98765-4321'));
  assert.ok(mesmoNumero('551187654321', '5511987654321'));
  assert.ok(!mesmoNumero('5521987654321', '5511987654321'));
});

/* ---------- API ---------- */
const ENV = {
  APP_SENHA: 'senha-de-teste', SESSION_SECRET: 'x'.repeat(40),
  WA_TOKEN: 'tok', WA_PHONE_NUMBER_ID: '123', WA_APP_SECRET: 'segredo-app', WA_VERIFY_TOKEN: 'verifica', WA_NUMERO_DONO: '5511987654321',
};

async function appTeste(fetchImpl) {
  const store = novoStore();
  const app = criarApp({ env: ENV, store, ia: semIA, fetchImpl, logger: false });
  await app.ready();
  return { app, store };
}

test('API exige login e salva dados depois de entrar', async () => {
  const { app } = await appTeste();
  assert.equal((await app.inject({ method: 'GET', url: '/api/estado' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/login', payload: { senha: 'errada' } })).statusCode, 401);
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { senha: 'senha-de-teste' } });
  assert.equal(login.statusCode, 200);
  const cookie = login.cookies.find((c) => c.name === 'cv_sessao');
  const headers = { cookie: `cv_sessao=${cookie.value}` };
  const put = await app.inject({ method: 'PUT', url: '/api/dados/metas/m1', headers, payload: { nome: 'Reserva', alvo: 3000 } });
  assert.equal(put.statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/dados/hack/x', headers, payload: {} })).statusCode, 400);
  const estado = (await app.inject({ method: 'GET', url: '/api/estado', headers })).json();
  assert.equal(estado.metas[0].nome, 'Reserva');
  const imp = await app.inject({ method: 'POST', url: '/api/importar', headers, payload: { backup: { contas: [{ id: 'c1', nome: 'Gás', valor: 35, vencimento: '2026-11-15', status: 'aberta' }], config: { rendaMensal: 3000 } } } });
  assert.equal(imp.json().registros, 1);
  const msg = await app.inject({ method: 'POST', url: '/api/ia/mensagem', headers, payload: { texto: 'gastei 12 no uber' } });
  assert.equal(msg.json().acoes[0].categoria, 'Transporte');
  await app.close();
});

test('webhook do WhatsApp: verificação, assinatura e só o dono é atendido', async () => {
  const enviados = [];
  const fakeFetch = async (url, opts) => { enviados.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({}), text: async () => '' }; };
  const { app, store } = await appTeste(fakeFetch);

  const v = await app.inject({ method: 'GET', url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=42' });
  assert.equal(v.body, '42');
  assert.equal((await app.inject({ method: 'GET', url: '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=42' })).statusCode, 403);

  const corpo = (de, id, texto) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from: de, type: 'text', text: { body: texto } }] } }] }] });
  const assinar = (b) => 'sha256=' + crypto.createHmac('sha256', ENV.WA_APP_SECRET).update(b).digest('hex');

  const b1 = corpo('5511987654321', 'wamid.1', 'gastei 30 no mercado');
  assert.equal((await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=errada' }, payload: b1 })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(b1) }, payload: b1 })).statusCode, 200);
  // reenvio da mesma mensagem pela Meta não duplica
  await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(b1) }, payload: b1 });
  const b2 = corpo('5521999999999', 'wamid.2', 'gastei 999 no mercado');
  await app.inject({ method: 'POST', url: '/webhook/whatsapp', headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(b2) }, payload: b2 });

  assert.equal(store.all('lancamentos').length, 1);
  assert.equal(store.all('lancamentos')[0].valor, 30);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].url, 'https://graph.facebook.com/v21.0/123/messages');
  assert.equal(enviados[0].body.to, '5511987654321');
  assert.match(enviados[0].body.text.body, /Registrado/);
  assert.ok(assinaturaValida('abc', 'sha256=' + crypto.createHmac('sha256', 'k').update('abc').digest('hex'), 'k'));
  await app.close();
});

test('armazenamento no Vercel Blob: grava só quando muda e repete em conflito', async () => {
  const { backendBlob } = require('../src/backend');
  class BlobPreconditionFailedError extends Error { constructor() { super('412'); this.name = 'BlobPreconditionFailedError'; } }
  let arquivo = null; let versao = 0; let gravacoes = 0; let conflitoUmaVez = true;
  const fake = {
    BlobPreconditionFailedError,
    async get() { return arquivo === null ? null : { statusCode: 200, stream: new Response(arquivo).body, blob: { etag: `v${versao}` } }; },
    async put(caminho, corpo, opts) {
      assert.equal(opts.access, 'private');
      if (conflitoUmaVez && arquivo !== null) { conflitoUmaVez = false; versao++; throw new BlobPreconditionFailedError(); }
      if (arquivo !== null && opts.ifMatch !== `v${versao}`) throw new BlobPreconditionFailedError();
      arquivo = corpo; versao++; gravacoes++;
    },
  };
  const b = backendBlob('token-falso', fake);
  await b.usar((s) => s.put('metas', { id: 'm1', nome: 'Reserva' }));
  assert.equal(gravacoes, 1);
  const lido = await b.usar((s) => s.estado());
  assert.equal(lido.metas[0].nome, 'Reserva');
  assert.equal(gravacoes, 1, 'leitura não grava');
  await b.usar((s) => s.put('metas', { id: 'm2', nome: 'Viagem' }));
  assert.equal(gravacoes, 2, 'repetiu depois do conflito');
  assert.equal((await b.usar((s) => s.all('metas'))).length, 2);
  const r = await b.usar(async (s) => f.processarMensagem({ store: s, ia: semIA, texto: 'gastei 9 no café', hoje: HOJE }));
  assert.equal(r.acoes[0].valor, 9);
  assert.equal((await b.usar((s) => s.all('lancamentos'))).length, 1);
});

test('saldo em conta: valor informado + lançamentos feitos depois', () => {
  const s = novoStore();
  s.setConfig({ saldoConta: 1000, saldoEm: '2026-11-07T12:00:00.000Z' });
  s.put('lancamentos', { id: 'antigo', tipo: 'despesa', valor: 50, data: '2026-11-07', criadoEm: '2026-11-07T10:00:00.000Z' });
  s.put('lancamentos', { id: 'g', tipo: 'despesa', valor: 120.5, data: '2026-11-07', criadoEm: '2026-11-07T15:00:00.000Z' });
  s.put('lancamentos', { id: 'r', tipo: 'receita', valor: 300, data: '2026-11-08', criadoEm: '2026-11-08T09:00:00.000Z' });
  s.put('lancamentos', { id: 'semData', tipo: 'despesa', valor: 10, data: '2026-11-09' });
  assert.equal(f.saldoAtual(s.estado()), 1169.5);
  assert.equal(f.saldoAtual(novoStore().estado()), null);
});
