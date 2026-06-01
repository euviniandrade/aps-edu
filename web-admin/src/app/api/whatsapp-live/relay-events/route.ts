/**
 * relay-events/route.ts — Edge Function para proxy SSE do relay local
 *
 * Roda na Vercel como Edge Function (Cloudflare Workers).
 * Sem timeout de 60s — pode manter a conexão SSE aberta indefinidamente.
 * O browser conecta aqui (mesmo domínio, sem CORS) e recebe eventos
 * em tempo real vindos do relay local via ngrok.
 */

export const runtime = 'edge'

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://prankster-scored-giver.ngrok-free.dev'
).replace(/\/api\/?$/, '').replace(/\/$/, '')

export async function GET() {
  const relayUrl = `${BACKEND_URL}/relay/events`

  try {
    const upstream = await fetch(relayUrl, {
      headers: {
        Accept:                        'text/event-stream',
        'Cache-Control':               'no-cache',
        'ngrok-skip-browser-warning':  'true',
        'User-Agent':                  'APS-EDU-Edge/1.0',
      },
      // Edge runtime suporta streaming de response sem flags extras
    })

    if (!upstream.ok || !upstream.body) {
      return errorStream('relay indisponível')
    }

    // Faz pipe direto do body upstream para o response — streaming puro
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':               'text/event-stream',
        'Cache-Control':              'no-cache',
        'X-Accel-Buffering':          'no',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e: any) {
    return errorStream(e?.message || 'erro desconhecido')
  }
}

function errorStream(msg: string) {
  const body = `event: error\ndata: ${JSON.stringify({ msg })}\n\n`
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
