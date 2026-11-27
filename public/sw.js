/* Galaxie Obras: service worker do app instalável (PWA).
 *
 * Objetivo: o Diário de obra abrir e funcionar sem internet no canteiro.
 * - Arquivos estáticos do Next (/_next/static, com hash no nome): cache primeiro.
 * - Páginas: rede primeiro (com tempo limite para sinal fraco) e, sem rede,
 *   a última cópia guardada. Sem cópia, uma página simples que leva ao Diário.
 * - Supabase, APIs e dados (RSC) passam direto: quem cuida dos dados offline é
 *   o próprio Diário, que guarda tudo no IndexedDB e sincroniza depois.
 */

const ESTATICOS = 'galaxie-estaticos-v1'
const PAGINAS = 'galaxie-paginas-v1'
const TEMPO_REDE_MS = 4000
const LIMITE_ESTATICOS = 400

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGINAS)
      .then((c) => c.add(new Request('/diario', { credentials: 'same-origin' })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((n) => n.startsWith('galaxie-') && n !== ESTATICOS && n !== PAGINAS)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  )
})

function ehEstatico(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:woff2?|png|svg|ico|webp|wasm)$/.test(url.pathname)
  )
}

async function podar(cache) {
  const chaves = await cache.keys()
  if (chaves.length > LIMITE_ESTATICOS) {
    await Promise.all(chaves.slice(0, chaves.length - LIMITE_ESTATICOS).map((k) => cache.delete(k)))
  }
}

async function cachePrimeiro(request) {
  const cache = await caches.open(ESTATICOS)
  const guardado = await cache.match(request)
  if (guardado) return guardado
  const resposta = await fetch(request)
  if (resposta.ok) {
    cache.put(request, resposta.clone()).then(() => podar(cache))
  }
  return resposta
}

function comTempoLimite(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('tempo')), ms)
    promessa.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

function paginaSemInternet() {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem internet · Galaxie Obras</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;background:#fff;color:#111}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}a{color:#9ecbff}}
main{max-width:360px;text-align:center}h1{font-size:18px}p{font-size:14px;opacity:.8}a{font-size:14px}</style></head>
<body><main><h1>Sem internet</h1><p>Esta tela ainda não foi aberta neste aparelho. O Diário de obra funciona sem conexão.</p>
<p><a href="/diario">Abrir o Diário de obra</a></p></main></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function redePrimeiro(event) {
  const request = event.request
  const cache = await caches.open(PAGINAS)
  const daRede = fetch(request).then((resposta) => {
    const tipo = resposta.headers.get('content-type') || ''
    if (resposta.ok && !resposta.redirected && tipo.includes('text/html')) {
      cache.put(request, resposta.clone())
    }
    return resposta
  })
  // Se a rede responder depois do tempo limite, a cópia ainda é atualizada.
  event.waitUntil(daRede.catch(() => {}))
  try {
    return await comTempoLimite(daRede, TEMPO_REDE_MS)
  } catch {
    const guardada =
      (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }))
    if (guardada) return guardada
    // A rede pode só estar lenta: espera mais um pouco antes de desistir.
    try {
      return await daRede
    } catch {
      return paginaSemInternet()
    }
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith(redePrimeiro(event))
    return
  }
  if (ehEstatico(url)) {
    event.respondWith(cachePrimeiro(request))
  }
})

// A página avisa o que carregou antes do service worker assumir (primeira
// visita) e pede limpeza das páginas ao sair da conta.
self.addEventListener('message', (event) => {
  const dados = event.data || {}
  if (dados.tipo === 'guardar' && Array.isArray(dados.urls)) {
    event.waitUntil(
      Promise.all([caches.open(ESTATICOS), caches.open(PAGINAS)]).then(([estaticos, paginas]) =>
        Promise.all(
          dados.urls.map(async (u) => {
            try {
              const url = new URL(u, self.location.origin)
              if (url.origin !== self.location.origin) return
              const alvo = ehEstatico(url) ? estaticos : dados.paginas?.includes(u) ? paginas : null
              if (!alvo || (await alvo.match(url.href))) return
              const resposta = await fetch(url.href, { credentials: 'same-origin' })
              const tipo = resposta.headers.get('content-type') || ''
              if (resposta.ok && !resposta.redirected && (alvo === estaticos || tipo.includes('text/html'))) {
                await alvo.put(url.href, resposta)
              }
            } catch {}
          })
        )
      )
    )
  }
  if (dados.tipo === 'sair') {
    event.waitUntil(caches.delete(PAGINAS))
  }
})
