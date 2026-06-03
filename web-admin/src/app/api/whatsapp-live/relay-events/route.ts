/**
 * relay-events/route.ts — Edge Function para proxy SSE do relay local
 *
 * Roda na Vercel como Edge Function (Cloudflare Workers).
 * Sem timeout de 60s — pode manter a conexão SSE aberta indefinidamente.
 * O browser conecta aqui (mesmo domínio, sem CORS) e recebe eventos
 * em tempo real vindos do relay local via ngrok.
 */

export const runtime = 'edge'

const FALLBACK_TUNNELS = [
  'https://cincinnati-amanda-bulk-cycling.trycloudflare.com',
  'https://travelling-poly-clinics-persons.trycloudflare.com',
]

function normalizeBackendUrl(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')
}

const BACKEND_URLS = Array.from(
  new Set([
    normalizeBackendUrl(process.env.BACKEND_URL || ''),
    normalizeBackendUrl(process.env.NEXT_PUBLIC_API_URL || ''),
    ...FALLBACK_TUNNELS.map(normalizeBackendUrl),
  ].filter(Boolean)),
)

async function fetchRelayFromBackend() {
  let lastError = ''

  for (const baseUrl of BACKEND_URLS) {
    try {
      const upstream = await fetch(`${baseUrl}/relay/events`, {
        headers: {
          Accept:                        'text/event-stream',
          'Cache-Control':               'no-cache',
          'ngrok-skip-browser-warning':  'true',
          'User-Agent':                  'APS-EDU-Edge/1.0',
        },
      })

      if (upstream.ok && upstream.body) {
        return upstream
      }

      const text = await upstream.text().catch(() => '')
      lastError = text || `http_${upstream.status}`
      if (upstream.status < 500 && !/bad gateway|unable to reach the origin service|cloudflared|origin service/i.test(text || '')) {
        break
      }
    } catch (e: any) {
      lastError = e?.message || 'fetch_failed'
    }
  }

  throw new Error(lastError || 'relay indisponivel')
}
export async function GET() {
  try {
    const upstream = await fetchRelayFromBackend()

    // Faz pipe direto do body upstream para o response ??? streaming puro
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
