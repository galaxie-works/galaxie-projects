import Stripe from 'stripe'

// Stripe só existe no servidor. Sem STRIPE_SECRET_KEY, a tela mostra os planos
// sem botão de pagar e as rotas respondem que a cobrança ainda não está ligada.

let cliente: Stripe | null = null

export function stripe(): Stripe | null {
  const chave = process.env.STRIPE_SECRET_KEY
  if (!chave) return null
  cliente ??= new Stripe(chave, { maxNetworkRetries: 2, appInfo: { name: 'Galaxie Obras' } })
  return cliente
}

export function cobrancaLigada() {
  return !!process.env.STRIPE_SECRET_KEY
}

/** Endereço público do app, para as voltas do checkout. */
export function urlApp(request: Request) {
  const fixa = process.env.NEXT_PUBLIC_APP_URL
  if (fixa) return fixa.replace(/\/$/, '')
  const u = new URL(request.url)
  return `${u.protocol}//${u.host}`
}

/** Preço do Stripe pela lookup_key (ex.: obras_equipe_mensal). */
export async function precoPorChave(s: Stripe, chave: string) {
  const lista = await s.prices.list({ lookup_keys: [chave], active: true, limit: 1 })
  return lista.data[0] ?? null
}
