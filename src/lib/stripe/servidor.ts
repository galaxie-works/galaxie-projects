import Stripe from 'stripe'
import { lerSegredo } from '@/lib/plataforma/segredos'

// Stripe só existe no servidor. A chave vem do painel do admin master (cifrada
// no banco) ou, se lá não tiver, de STRIPE_SECRET_KEY na Vercel. Sem nenhuma,
// a tela mostra os planos sem botão de pagar e as rotas respondem que a
// cobrança ainda não está ligada.

const clientes = new Map<string, Stripe>()

export function stripeCom(chave: string): Stripe {
  let c = clientes.get(chave)
  if (!c) {
    c = new Stripe(chave, { maxNetworkRetries: 2, appInfo: { name: 'Galaxie Obras' } })
    clientes.clear()
    clientes.set(chave, c)
  }
  return c
}

export async function stripe(): Promise<Stripe | null> {
  const chave = await lerSegredo('STRIPE_SECRET_KEY')
  return chave ? stripeCom(chave) : null
}

export async function cobrancaLigada() {
  return !!(await lerSegredo('STRIPE_SECRET_KEY'))
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
