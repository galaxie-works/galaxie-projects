import type Stripe from 'stripe'
import { lookupKey, type Plano } from '@/lib/planos'
import type { ConfigPlataforma } from './config'

// Leva para o Stripe os preços que o admin master salvou no painel.
// Cada preço é achado pela lookup_key (obras_equipe_mensal etc.). Preço do
// Stripe não muda de valor: quando o valor muda, nasce um preço novo com a
// mesma lookup_key (transfer_lookup_key) e o antigo é arquivado. Quem já
// assina continua no preço antigo até trocar de plano; quem assina depois paga
// o novo.

interface ItemPreco {
  chave: string
  /** Agrupa os preços do mesmo produto (metadata do produto no Stripe). */
  produtoId: string
  produtoNome: string
  valor: number
  intervalo: 'month' | 'year' | null
}

export interface ResultadoPreco {
  chave: string
  situacao: 'igual' | 'criado' | 'atualizado' | 'erro'
  detalhe?: string
}

export function itensDePreco(planos: Plano[], config: ConfigPlataforma): ItemPreco[] {
  return [
    ...planos.flatMap((p) => [
      { chave: lookupKey(p.id, 'mensal'), produtoId: p.id, produtoNome: `Galaxie Obras ${p.nome}`, valor: p.mensal, intervalo: 'month' as const },
      { chave: lookupKey(p.id, 'anual'), produtoId: p.id, produtoNome: `Galaxie Obras ${p.nome}`, valor: p.anual, intervalo: 'year' as const },
    ]),
    {
      chave: config.usuarioExtra.lookupKey,
      produtoId: 'usuario_extra',
      produtoNome: 'Usuário extra no escritório',
      valor: config.usuarioExtra.preco,
      intervalo: 'month',
    },
    {
      chave: config.pacoteIA.lookupKey,
      produtoId: 'pacote_ia',
      produtoNome: `${config.pacoteIA.comandos.toLocaleString('pt-BR')} comandos de IA`,
      valor: config.pacoteIA.preco,
      intervalo: null,
    },
  ]
}

const centavos = (reais: number) => Math.round(reais * 100)

async function garantirProduto(s: Stripe, item: ItemPreco, atual: Stripe.Price | null, cache: Map<string, string>) {
  const doPreco = atual ? (typeof atual.product === 'string' ? atual.product : atual.product.id) : null
  let id = cache.get(item.produtoId) ?? doPreco
  if (!id) {
    const achado = (
      await s.products.search({ query: `metadata['galaxie_obras']:'${item.produtoId}' AND active:'true'`, limit: 1 })
    ).data[0]
    id =
      achado?.id ??
      (await s.products.create({ name: item.produtoNome, metadata: { galaxie_obras: item.produtoId } })).id
  }
  if (!cache.has(item.produtoId)) {
    // Nome do plano mudou no painel: o produto acompanha (aparece no checkout e na fatura).
    const p = await s.products.retrieve(id)
    if (p.name !== item.produtoNome || p.metadata?.galaxie_obras !== item.produtoId) {
      await s.products.update(id, { name: item.produtoNome, metadata: { galaxie_obras: item.produtoId } })
    }
    cache.set(item.produtoId, id)
  }
  return id
}

export async function sincronizarPrecos(s: Stripe, itens: ItemPreco[]): Promise<ResultadoPreco[]> {
  const produtos = new Map<string, string>()
  const resultados: ResultadoPreco[] = []
  for (const item of itens) {
    try {
      const atual = (await s.prices.list({ lookup_keys: [item.chave], active: true, limit: 1 })).data[0] ?? null
      const produto = await garantirProduto(s, item, atual, produtos)
      const mesmoValor =
        atual &&
        atual.currency === 'brl' &&
        atual.unit_amount === centavos(item.valor) &&
        (atual.recurring?.interval ?? null) === item.intervalo &&
        (typeof atual.product === 'string' ? atual.product : atual.product.id) === produto
      if (mesmoValor) {
        resultados.push({ chave: item.chave, situacao: 'igual' })
        continue
      }
      const novo = await s.prices.create({
        product: produto,
        currency: 'brl',
        unit_amount: centavos(item.valor),
        lookup_key: item.chave,
        transfer_lookup_key: true,
        ...(item.intervalo ? { recurring: { interval: item.intervalo } } : {}),
      })
      if (atual) await s.prices.update(atual.id, { active: false })
      resultados.push({ chave: item.chave, situacao: atual ? 'atualizado' : 'criado', detalhe: novo.id })
    } catch (e) {
      resultados.push({ chave: item.chave, situacao: 'erro', detalhe: e instanceof Error ? e.message : String(e) })
    }
  }
  return resultados
}

/** Eventos que o webhook do app trata (src/app/api/stripe/webhook/route.ts). */
export const EVENTOS_WEBHOOK: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]
