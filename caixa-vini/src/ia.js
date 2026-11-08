'use strict';
// Provedor de IA. Usa Claude (ANTHROPIC_API_KEY) ou Gemini (GEMINI_API_KEY), o que estiver configurado.
// Áudio do WhatsApp só é transcrito pelo Gemini (a API do Claude não recebe áudio).

const TIMEOUT_MS = 45000;

function extrairJSON(texto) {
  const t = String(texto || '').trim();
  try { return JSON.parse(t); } catch {}
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cerca) { try { return JSON.parse(cerca[1]); } catch {} }
  const i = t.indexOf('{'); const f = t.lastIndexOf('}');
  if (i >= 0 && f > i) { try { return JSON.parse(t.slice(i, f + 1)); } catch {} }
  return null;
}

function criarIA(env = process.env, fetchImpl = globalThis.fetch) {
  const chaveClaude = env.ANTHROPIC_API_KEY;
  const chaveGemini = env.GEMINI_API_KEY;
  const provedor = chaveClaude ? 'claude' : chaveGemini ? 'gemini' : null;

  const modelos = {
    claude: { rapido: env.IA_MODELO_RAPIDO || 'claude-haiku-5-5', resposta: env.IA_MODELO || 'claude-sonnet-5-5' },
    gemini: { rapido: env.IA_MODELO_RAPIDO || 'gemini-2.5-flash', resposta: env.IA_MODELO || 'gemini-2.5-flash' },
  };

  async function claude(prompt, { rapido, maxTokens }) {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': chaveClaude, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: rapido ? modelos.claude.rapido : modelos.claude.resposta,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`Claude respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const d = await r.json();
    return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }

  async function gemini(partes, { rapido, json }) {
    const modelo = rapido ? modelos.gemini.rapido : modelos.gemini.resposta;
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': chaveGemini, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: json ? { responseMimeType: 'application/json' } : {},
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`Gemini respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const d = await r.json();
    return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  }

  async function texto(prompt, { rapido = false, json = false } = {}) {
    if (provedor === 'claude') return claude(prompt, { rapido, maxTokens: json ? 1500 : 1200 });
    if (provedor === 'gemini') return gemini([{ text: prompt }], { rapido, json });
    throw new Error('IA não configurada');
  }

  return {
    provedor,
    podeAudio: Boolean(chaveGemini),
    texto,
    async json(prompt) {
      const t = await texto(prompt, { rapido: true, json: true });
      const v = extrairJSON(t);
      if (v === null) throw new Error('A IA não devolveu JSON válido');
      return v;
    },
    async transcrever(buffer, mime) {
      if (!chaveGemini) return null;
      const t = await gemini([
        { text: 'Transcreva este áudio em português do Brasil, exatamente como foi falado. Responda só com a transcrição, sem comentários.' },
        { inline_data: { mime_type: (mime || 'audio/ogg').split(';')[0], data: Buffer.from(buffer).toString('base64') } },
      ], { rapido: true, json: false });
      return t.trim();
    },
  };
}

module.exports = { criarIA, extrairJSON };
