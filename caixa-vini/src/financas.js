'use strict';
// Regras de negócio usadas pelo assistente do app e pelo robô do WhatsApp.
const crypto = require('crypto');

const CATEGORIAS = ['Moradia', 'Contas da casa', 'Alimentação', 'Transporte', 'Educação', 'Saúde', 'Cartão de crédito', 'Empréstimos', 'Assinaturas', 'Lazer', 'Compras', 'Pessoal', 'Trabalho/PJ', 'Outros'];
const CAT_REC = ['Salário', 'Freelance/PJ', 'Comissões', 'Vendas', 'Reembolso', 'Outros'];
const METODOS = ['Pix', 'Débito', 'Cartão de crédito', 'Dinheiro', 'Boleto', 'Transferência'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const FUSO = 'America/Sao_Paulo';

const uid = () => crypto.randomUUID();
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (v) => BRL.format(Number(v) || 0).replace(/ /g, ' ');

// Data de hoje no fuso de São Paulo, como YYYY-MM-DD (o servidor roda em UTC).
function hojeISO(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoD = (d) => d.toISOString().slice(0, 10);
const ym = (s) => (s ? String(s).slice(0, 7) : '');
const fmtD = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—');
const diasEntre = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
function addMeses(s, n) {
  const d = parseD(s); const dia = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const ultimo = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(dia, ultimo));
  return isoD(t);
}
function addDias(s, n) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return isoD(d); }
const soma = (arr, f = 'valor') => round2(arr.reduce((a, x) => a + (Number(x[f]) || 0), 0));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/* ---------- pagamentos ---------- */
function pagarConta(store, conta, valorPago, dataPag) {
  const ret = {};
  store.put('contas', { ...conta, status: 'paga', pagoEm: dataPag, valorPago: round2(valorPago), atualizadoEm: new Date().toISOString() });
  ret.lancId = uid();
  store.put('lancamentos', {
    id: ret.lancId, tipo: 'despesa',
    descricao: conta.nome + (conta.parcelaTotal ? ` (${conta.parcelaAtual}/${conta.parcelaTotal})` : ''),
    valor: round2(valorPago), data: dataPag, categoria: conta.categoria, metodo: conta.metodo || '', contaId: conta.id,
    criadoEm: new Date().toISOString(),
  });
  const temParcela = Number(conta.parcelaTotal) > 0;
  if (conta.recorrencia === 'mensal' && (!temParcela || Number(conta.parcelaAtual) < Number(conta.parcelaTotal))) {
    const serie = conta.serie || conta.id;
    const venc = addMeses(conta.vencimento, 1);
    const existe = store.all('contas').some((x) => x.serie === serie && ym(x.vencimento) === ym(venc));
    if (!existe) {
      const prox = { ...conta, id: uid(), serie, vencimento: venc, status: 'aberta', pagoEm: null, valorPago: null };
      if (temParcela) prox.parcelaAtual = Number(conta.parcelaAtual) + 1;
      store.put('contas', prox);
      ret.proxId = prox.id;
    }
  }
  return ret;
}

/* ---------- saldo em conta ---------- */
// Valor informado pelo usuário (config.saldoConta em config.saldoEm) + entradas − saídas lançadas depois.
function saldoAtual(estado) {
  const em = estado.config?.saldoEm; const base = Number(estado.config?.saldoConta);
  if (!em || !Number.isFinite(base)) return null;
  const dia = String(em).slice(0, 10);
  let v = base;
  for (const l of estado.lancamentos) {
    const depois = l.criadoEm ? l.criadoEm > em : l.data > dia;
    if (depois) v += (l.tipo === 'receita' ? 1 : -1) * (Number(l.valor) || 0);
  }
  return round2(v);
}

/* ---------- resumo ---------- */
function resumoMes(estado, hoje) {
  const k = ym(hoje);
  const abertas = estado.contas.filter((c) => c.status !== 'paga');
  const doMes = estado.contas.filter((c) => ym(c.vencimento) === k);
  const atrasadas = abertas.filter((c) => c.vencimento < hoje);
  const aPagar = round2(soma(abertas.filter((c) => ym(c.vencimento) === k)) + soma(abertas.filter((c) => ym(c.vencimento) < k)));
  const lanc = estado.lancamentos.filter((l) => ym(l.data) === k);
  const receitas = soma(lanc.filter((l) => l.tipo === 'receita'));
  const despesas = soma(lanc.filter((l) => l.tipo === 'despesa'));
  const renda = Math.max(receitas, Number(estado.config.rendaMensal) || 0);
  const metas = soma(estado.metas, 'aporteMensal');
  const livre = round2(renda - despesas - aPagar - metas);
  const pago = soma(doMes.filter((c) => c.status === 'paga'), 'valorPago');
  return { k, abertas, atrasadas, aPagar, receitas, despesas, renda, livre, pago, temRenda: renda > 0 };
}

function textoResumo(estado, hoje) {
  const r = resumoMes(estado, hoje);
  const mes = MESES[Number(hoje.slice(5, 7)) - 1];
  const prox = r.abertas.filter((c) => diasEntre(hoje, c.vencimento) >= 0 && diasEntre(hoje, c.vencimento) <= 10).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const saldo = saldoAtual(estado);
  const l = [`📊 *Resumo de ${mes}*`, saldo === null ? 'Saldo em conta: informe no app' : `💰 Saldo em conta: *${brl(saldo)}*`, `Falta pagar: *${brl(r.aPagar)}*`, `Já pago: ${brl(r.pago)} · Gastos lançados: ${brl(r.despesas)}`];
  l.push(r.temRenda ? `Livre para gastar: *${brl(r.livre)}*` : 'Livre para gastar: informe sua renda no app');
  if (r.atrasadas.length) l.push('', `⚠️ *Vencidas* (${brl(soma(r.atrasadas))})`, ...r.atrasadas.map((c) => `• ${fmtD(c.vencimento)} ${c.nome} — ${brl(c.valor)}`));
  if (prox.length) l.push('', '📅 *Próximos 10 dias*', ...prox.map((c) => `• ${fmtD(c.vencimento)} ${c.nome} — ${brl(c.valor)}${c.debitoAuto ? ' (débito auto)' : ''}`));
  return l.join('\n');
}

function textoContas(estado, hoje) {
  const abertas = estado.contas.filter((c) => c.status !== 'paga').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  if (!abertas.length) return '✅ Nenhuma conta em aberto.';
  return ['🧾 *Contas em aberto*', ...abertas.map((c) => `• ${fmtD(c.vencimento)} ${c.nome} — ${brl(c.valor)}${c.vencimento < hoje ? ' ⚠️ vencida' : ''}`), '', `Total: *${brl(soma(abertas))}*`].join('\n');
}

const AJUDA = [
  '👋 Sou o assistente do *Caixa Vini*. Fale comigo como numa conversa:',
  '• "gastei 45 no mercado no pix"',
  '• "uber 18" · "ifood 52 ontem no crédito"',
  '• "recebi 2.500 de salário"',
  '• "paguei a Claro"',
  '• "luz 120 vence dia 20"',
  '• "quanto posso gastar até o fim do mês?"',
  '',
  'Comandos: *resumo*, *contas*, *desfazer*, *ajuda*.',
  'Pode mandar áudio também 🎙️',
].join('\n');

/* ---------- IA: prompts ---------- */
function promptAcoes(texto, estado, hoje) {
  const abertas = estado.contas.filter((c) => c.status !== 'paga').sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 40)
    .map((c) => `${c.id} | ${c.nome} | ${c.valor} | vence ${c.vencimento}`).join('\n') || '(nenhuma)';
  const dia = DIAS[parseD(hoje).getUTCDay()];
  return `Você é o leitor de lançamentos do app de finanças pessoais "Caixa Vini" (Brasil, valores em reais).
Hoje é ${dia}, ${hoje}.

Transforme a mensagem do usuário em ações. Responda SOMENTE com um objeto JSON neste formato:
{"acoes":[...],"resposta":"frase curta em português confirmando o que entendeu","pergunta":false}

Tipos de ação (use exatamente estes campos):
- {"tipo":"despesa","descricao":"Mercado","valor":45.9,"data":"YYYY-MM-DD","categoria":"...","metodo":"..."}
- {"tipo":"receita","descricao":"Salário","valor":2500,"data":"YYYY-MM-DD","categoria":"..."}
- {"tipo":"conta","nome":"Conta de luz","valor":120,"vencimento":"YYYY-MM-DD","categoria":"...","recorrencia":"nenhuma"|"mensal","parcelaAtual":null,"parcelaTotal":null}
- {"tipo":"pagar","contaId":"<id da lista abaixo>","valor":94.2,"data":"YYYY-MM-DD"}

Categorias de despesa e conta: ${CATEGORIAS.join(', ')}.
Categorias de receita: ${CAT_REC.join(', ')}.
Formas de pagamento: ${METODOS.join(', ')}.

Contas em aberto (id | nome | valor | vencimento):
${abertas}

Regras:
- "gastei", "comprei", "paguei" algo que NÃO está na lista, ou algo que vai gastar agora/hoje = despesa com a data de hoje (ou a data dita: "ontem", "sexta").
- "paguei a Claro", "paguei o boleto da escola" = pagar, com o contaId da conta correspondente; valor = o dito ou o da conta.
- Conta, boleto ou parcela com vencimento futuro ("vence dia 20", "tenho que pagar") = conta. Dia sem mês = próximo dia com esse número a partir de hoje.
- "recebi", "caiu", "entrou", salário, pix recebido = receita.
- Entenda gírias e números falados: "45 conto", "1,5 mil" = 1500, "dez reais" = 10, "trinta e dois e cinquenta" = 32.5. Valor sempre número com ponto decimal.
- Várias coisas numa frase = várias ações.
- Sem forma de pagamento dita: despesa usa "Pix".
- Se for uma pergunta, pedido de conselho ou análise (sem nada para registrar): "acoes":[] e "pergunta":true.
- Se faltar o valor, não invente: "acoes":[] e peça o valor em "resposta".

Mensagem do usuário: """${String(texto).slice(0, 1500)}"""`;
}

function contexto(estado, hoje) {
  const r = resumoMes(estado, hoje);
  const g = gastoCategoria(estado, ym(hoje));
  const orc = estado.config.orcamentos || {};
  return [
    `Hoje: ${DIAS[parseD(hoje).getUTCDay()]}, ${hoje}.`,
    `Saldo em conta agora: ${saldoAtual(estado) ?? 'não informado'}.`,
    `Renda mensal informada: ${estado.config.rendaMensal || 0}. Entradas lançadas no mês: ${r.receitas}. Reserva de emergência: ${estado.config.reserva || 0}.`,
    `Mês ${r.k}: falta pagar ${r.aPagar}; já pago em contas ${r.pago}; gastos lançados ${r.despesas}; livre para gastar ${r.livre} (renda − gastos − contas em aberto − metas).`,
    'Contas em aberto: ' + (r.abertas.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((c) => `${c.nome} ${c.valor} vence ${c.vencimento}${c.debitoAuto ? ' (débito automático)' : ''}`).join('; ') || 'nenhuma'),
    'Cartões: ' + (estado.cartoes.map((c) => `${c.nome} limite disponível ${c.limiteDisponivel}, fecha dia ${c.fechamento}, vence dia ${c.vencimento}`).join('; ') || 'nenhum'),
    'Gasto previsto por categoria no mês: ' + (Object.entries(g).map(([c, v]) => `${c} ${round2(v)}${orc[c] ? ` (limite ${orc[c]})` : ''}`).join('; ') || 'nenhum'),
    'Dívidas: ' + (estado.dividas.map((d) => `${d.nome} saldo ${d.saldo}, parcela ${d.parcela}, juros ${d.jurosMes || '?'}% a.m.`).join('; ') || 'nenhuma'),
    'Metas: ' + (estado.metas.map((m) => `${m.nome} ${m.atual}/${m.alvo}`).join('; ') || 'nenhuma'),
    'Últimos lançamentos: ' + (estado.lancamentos.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 25).map((l) => `${l.data} ${l.tipo} ${l.descricao} ${l.valor} (${l.categoria})`).join('; ') || 'nenhum'),
  ].join('\n');
}

function gastoCategoria(estado, k) {
  const m = {};
  estado.lancamentos.filter((l) => l.tipo === 'despesa' && ym(l.data) === k).forEach((l) => { m[l.categoria] = (m[l.categoria] || 0) + Number(l.valor || 0); });
  estado.contas.filter((c) => c.status !== 'paga' && ym(c.vencimento) === k).forEach((c) => { m[c.categoria] = (m[c.categoria] || 0) + Number(c.valor || 0); });
  return m;
}

function promptPergunta(pergunta, estado, hoje, canal) {
  return `Você é um consultor financeiro pessoal, direto e prático, falando com o Vini (Brasil, reais). Use só os dados abaixo. Responda em português do Brasil em até 8 linhas, com números concretos em R$. Pode usar listas com "- ". Sem títulos.${canal === 'whatsapp' ? ' Para destacar, use *asteriscos* (formato do WhatsApp).' : ' Sem markdown.'} Se faltar um dado importante (como a renda), diga qual é e como informar no app.

DADOS DO APP
${contexto(estado, hoje)}

PERGUNTA
${String(pergunta).slice(0, 1500)}`;
}

/* ---------- ações ---------- */
function normalizarAcoes(arr, store, hoje) {
  const out = [];
  const dataOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : hoje);
  for (const a of Array.isArray(arr) ? arr : []) {
    if (!a || typeof a !== 'object') continue;
    const valor = round2(String(a.valor ?? '').replace(',', '.'));
    if (a.tipo === 'despesa' && valor > 0) out.push({ tipo: 'despesa', descricao: String(a.descricao || 'Gasto').slice(0, 80), valor, data: dataOk(a.data), categoria: CATEGORIAS.includes(a.categoria) ? a.categoria : 'Outros', metodo: METODOS.includes(a.metodo) ? a.metodo : 'Pix' });
    else if (a.tipo === 'receita' && valor > 0) out.push({ tipo: 'receita', descricao: String(a.descricao || 'Entrada').slice(0, 80), valor, data: dataOk(a.data), categoria: CAT_REC.includes(a.categoria) ? a.categoria : 'Outros' });
    else if (a.tipo === 'conta' && valor > 0) out.push({ tipo: 'conta', nome: String(a.nome || a.descricao || 'Conta').slice(0, 80), valor, vencimento: dataOk(a.vencimento), categoria: CATEGORIAS.includes(a.categoria) ? a.categoria : 'Outros', recorrencia: a.recorrencia === 'mensal' ? 'mensal' : 'nenhuma', parcelaAtual: Number(a.parcelaAtual) || null, parcelaTotal: Number(a.parcelaTotal) || null });
    else if (a.tipo === 'pagar') {
      const c = store.get('contas', String(a.contaId || ''));
      if (c && c.status !== 'paga') out.push({ tipo: 'pagar', contaId: c.id, nome: c.nome, descricao: c.nome, categoria: c.categoria, valor: valor > 0 ? valor : c.valor, data: dataOk(a.data) });
    }
  }
  return out.slice(0, 10);
}

function executarAcoes(store, acoes, origem) {
  return store.transacao(() => {
    const feitos = [];
    for (const a of acoes) {
      if (a.tipo === 'despesa' || a.tipo === 'receita') {
        const id = uid();
        store.put('lancamentos', { id, tipo: a.tipo, descricao: a.descricao, valor: a.valor, data: a.data, categoria: a.categoria, metodo: a.metodo || '', obs: `via ${origem}`, criadoEm: new Date().toISOString() });
        feitos.push({ col: 'lancamentos', id });
      } else if (a.tipo === 'conta') {
        const id = uid();
        store.put('contas', { id, nome: a.nome, valor: a.valor, vencimento: a.vencimento, categoria: a.categoria, metodo: 'Boleto', recorrencia: a.parcelaTotal ? 'mensal' : a.recorrencia, parcelaAtual: a.parcelaTotal ? (a.parcelaAtual || 1) : null, parcelaTotal: a.parcelaTotal, debitoAuto: false, cartaoId: '', obs: `via ${origem}`, status: 'aberta' });
        feitos.push({ col: 'contas', id });
      } else if (a.tipo === 'pagar') {
        const c = store.get('contas', a.contaId);
        if (c && c.status !== 'paga') feitos.push({ pagamento: true, conta: { ...c }, ...pagarConta(store, c, a.valor, a.data) });
      }
    }
    return feitos;
  });
}

function desfazer(store, feitos) {
  store.transacao(() => {
    for (const f of [...(feitos || [])].reverse()) {
      if (f.pagamento && f.conta?.id) {
        store.put('contas', { ...f.conta });
        if (f.lancId) store.del('lancamentos', f.lancId);
        if (f.proxId) store.del('contas', f.proxId);
      } else if (f.col && f.id && ['lancamentos', 'contas'].includes(f.col)) {
        store.del(f.col, f.id);
      }
    }
  });
}

/* ---------- leitor simples (sem IA) ---------- */
const PALAVRAS = [
  [/mercad|supermerc|ifood|lanche|restaurante|padaria|a[çc]ougue|comida|pizza|hamb|almo[çc]o|jantar|caf[eé]|feira/, 'Alimentação'],
  [/uber|\b99\b|gasolina|combust|[ôo]nibus|metr[ôo]|estacionamento|ped[áa]gio|t[áa]xi|passagem/, 'Transporte'],
  [/\bluz\b|energia|[áa]gua|\bg[áa]s\b|internet|claro|vivo|\btim\b|\boi\b/, 'Contas da casa'],
  [/aluguel|condom[íi]nio|iptu/, 'Moradia'],
  [/farm[áa]cia|rem[ée]dio|m[ée]dico|consulta|dentista|exame|academia/, 'Saúde'],
  [/escola|mensalidade|curso|livro|faculdade|material/, 'Educação'],
  [/netflix|spotify|assinatura|prime|youtube|disney|icloud/, 'Assinaturas'],
  [/cinema|\bbar\b|show|viagem|lazer|passeio|cerveja/, 'Lazer'],
  [/roupa|loja|shopping|amazon|shopee|mercado livre|magalu|t[êe]nis/, 'Compras'],
  [/fatura|cart[ãa]o/, 'Cartão de crédito'],
  [/empr[ée]stimo|parcela/, 'Empréstimos'],
];
function parseLocal(texto, hoje) {
  const s = String(texto).toLowerCase();
  const m = s.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k\b)?/);
  if (!m) return { acoes: [], resposta: 'Não achei o valor. Tente algo como "gastei 45 no mercado".', pergunta: /\?\s*$/.test(s) };
  let valor = Number(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2] : ''));
  if (m[3]) valor *= 1000;
  const receita = /(recebi|ganhei|caiu|entrou|sal[áa]rio|vendi)/.test(s);
  let data = hoje;
  if (/anteontem/.test(s)) data = addDias(hoje, -2); else if (/ontem/.test(s)) data = addDias(hoje, -1);
  let cat = 'Outros';
  for (const [re, c] of PALAVRAS) { if (re.test(s)) { cat = c; break; } }
  const metodo = /cr[ée]dito|cart[ãa]o/.test(s) ? 'Cartão de crédito' : /d[ée]bito/.test(s) ? 'Débito' : /dinheiro/.test(s) ? 'Dinheiro' : 'Pix';
  const desc = String(texto)
    .replace(/(gastei|paguei|comprei|recebi|ganhei|vou gastar|agora|hoje|anteontem|ontem|reais|conto|no pix|de pix|pix|no cr[ée]dito|no d[ée]bito|no cart[ãa]o|em dinheiro)/gi, ' ')
    .replace(/(R\$\s*)?\d[\d.,]*\s*(mil|k\b)?/gi, ' ')
    .replace(/\b(no|na|de|do|da|com|em|um|uma|o|a)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const descricao = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : (receita ? 'Entrada' : cat);
  return {
    acoes: [receita
      ? { tipo: 'receita', descricao, valor, data, categoria: /sal[áa]rio/.test(s) ? 'Salário' : 'Outros' }
      : { tipo: 'despesa', descricao, valor, data, categoria: cat, metodo }],
    resposta: 'Registrei:',
  };
}

// Sem IA: "paguei a Claro" procura uma conta em aberto cujo nome tenha uma palavra da frase.
const semAcento = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function pagamentoLocal(texto, store, hoje) {
  const s = semAcento(texto);
  if (!/\b(paguei|pago|quitei)\b/.test(s)) return null;
  const palavras = s.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !['paguei', 'pago', 'quitei', 'conta', 'boleto', 'fatura', 'reais', 'hoje', 'ontem'].includes(w));
  const abertas = store.all('contas').filter((c) => c.status !== 'paga').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const conta = abertas.find((c) => palavras.some((w) => semAcento(c.nome).split(/[^a-z0-9]+/).includes(w)));
  if (!conta) return null;
  const m = s.match(/(\d+)(?:,(\d{1,2}))?/);
  const valor = m ? Number(m[1] + (m[2] ? '.' + m[2] : '')) : conta.valor;
  return { acoes: [{ tipo: 'pagar', contaId: conta.id, valor, data: /ontem/.test(s) ? addDias(hoje, -1) : hoje }], resposta: `Marquei ${conta.nome} como paga.` };
}

const NOMES = { despesa: 'Gasto', receita: 'Entrada', conta: 'Conta a pagar', pagar: 'Pagamento' };
function linhaAcao(a) {
  const quando = a.tipo === 'conta' ? `vence ${fmtD(a.vencimento)}` : fmtD(a.data);
  const extra = [a.categoria, a.metodo, quando, a.parcelaTotal ? `${a.parcelaAtual || 1}/${a.parcelaTotal}` : '', a.recorrencia === 'mensal' && !a.parcelaTotal ? 'todo mês' : ''].filter(Boolean).join(', ');
  return `• ${NOMES[a.tipo]} ${brl(a.valor)} — ${a.descricao || a.nome} (${extra})`;
}

/* ---------- entrada única: app e WhatsApp ---------- */
async function processarMensagem({ store, ia, texto, canal = 'app', log = console, hoje = hojeISO() }) {
  const t = String(texto || '').trim();
  const estado = () => store.estado();
  if (!t) return { resposta: AJUDA, acoes: [], feitos: [] };
  const cmd = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[!?.]+$/, '').trim();
  if (canal === 'whatsapp') {
    if (/^(oi|ola|ajuda|menu|help|comandos)$/.test(cmd)) return { resposta: AJUDA, acoes: [], feitos: [] };
    if (/^(resumo|saldo|status|como estou)$/.test(cmd)) return { resposta: textoResumo(estado(), hoje), acoes: [], feitos: [] };
    if (/^(contas|vencimentos|a pagar|boletos)$/.test(cmd)) return { resposta: textoContas(estado(), hoje), acoes: [], feitos: [] };
    if (/^(desfazer|desfaz|cancelar|apagar ultimo|errou)$/.test(cmd)) {
      const ult = store.get('sistema', 'ultimoWhatsapp');
      if (!ult?.feitos?.length) return { resposta: 'Não há nada para desfazer.', acoes: [], feitos: [] };
      desfazer(store, ult.feitos);
      store.del('sistema', 'ultimoWhatsapp');
      return { resposta: '↩️ Desfeito. O último registro foi removido.', acoes: [], feitos: [] };
    }
  }

  let res = null;
  if (ia?.provedor) {
    try { res = await ia.json(promptAcoes(t, estado(), hoje)); }
    catch (e) { log.warn?.({ err: e.message }, 'IA falhou ao ler a mensagem; usando leitor simples'); }
  }
  if (!res) res = pagamentoLocal(t, store, hoje) || parseLocal(t, hoje);

  const acoes = normalizarAcoes(res.acoes, store, hoje);
  if (acoes.length) {
    const feitos = executarAcoes(store, acoes, canal === 'whatsapp' ? 'WhatsApp' : 'assistente');
    if (canal === 'whatsapp') store.put('sistema', { id: 'ultimoWhatsapp', feitos, em: new Date().toISOString() });
    const r = resumoMes(estado(), hoje);
    const resposta = canal === 'whatsapp'
      ? ['✅ *Registrado:*', ...acoes.map(linhaAcao), '', ...(saldoAtual(estado()) !== null ? [`Saldo em conta: *${brl(saldoAtual(estado()))}*`] : []), r.temRenda ? `Livre para gastar no mês: *${brl(r.livre)}*` : `Falta pagar no mês: *${brl(r.aPagar)}*`, 'Errei? Responda *desfazer*.'].join('\n')
      : String(res.resposta || 'Pronto, registrei:').slice(0, 300);
    return { resposta, acoes, feitos };
  }
  if (res.pergunta) {
    if (!ia?.provedor) return { resposta: 'Para responder perguntas, configure a chave de IA (GEMINI_API_KEY ou ANTHROPIC_API_KEY) no servidor.', acoes: [], feitos: [], pergunta: true };
    try {
      const txt = await ia.texto(promptPergunta(t, estado(), hoje, canal));
      return { resposta: txt.trim().slice(0, 3500), acoes: [], feitos: [], pergunta: true };
    } catch (e) {
      log.error?.({ err: e.message }, 'IA falhou ao responder');
      return { resposta: 'Não consegui responder agora. Tente de novo em instantes.', acoes: [], feitos: [], pergunta: true };
    }
  }
  return { resposta: String(res.resposta || 'Não entendi o valor. Tente algo como "gastei 45 no mercado".').slice(0, 400), acoes: [], feitos: [] };
}

module.exports = {
  CATEGORIAS, CAT_REC, METODOS, AJUDA,
  hojeISO, addMeses, brl, round2, saldoAtual,
  pagarConta, resumoMes, textoResumo, textoContas,
  promptAcoes, promptPergunta, normalizarAcoes, executarAcoes, desfazer, parseLocal, processarMensagem,
};
