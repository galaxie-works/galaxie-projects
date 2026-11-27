// Hoje o painel do admin master (/admin → Planos → "Conferir no Stripe") faz o
// mesmo sem terminal, usando os preços salvos no painel. Este script fica de reserva.
//
// Cria (ou confere) no Stripe os produtos e preços do Galaxie Obras, com as
// lookup_keys que o app procura (src/lib/planos.ts). Pode rodar de novo: o que
// já existe com a mesma lookup_key fica como está.
//
//   STRIPE_SECRET_KEY=sk_... node scripts/stripe-criar-precos.mjs
//
// Preços em reais. Mudou um valor? Crie um preço novo com a mesma chave e
// transfer_lookup_key (o antigo some da busca; assinaturas antigas continuam).

import Stripe from 'stripe'

const s = new Stripe(process.env.STRIPE_SECRET_KEY)

const ITENS = [
  { produto: 'Galaxie Obras Autônomo', chave: 'obras_autonomo_mensal', valor: 89, intervalo: 'month' },
  { produto: 'Galaxie Obras Autônomo', chave: 'obras_autonomo_anual', valor: 890, intervalo: 'year' },
  { produto: 'Galaxie Obras Equipe', chave: 'obras_equipe_mensal', valor: 199, intervalo: 'month' },
  { produto: 'Galaxie Obras Equipe', chave: 'obras_equipe_anual', valor: 1990, intervalo: 'year' },
  { produto: 'Galaxie Obras Empresa', chave: 'obras_empresa_mensal', valor: 399, intervalo: 'month' },
  { produto: 'Galaxie Obras Empresa', chave: 'obras_empresa_anual', valor: 3990, intervalo: 'year' },
  { produto: 'Usuário extra no escritório', chave: 'obras_usuario_extra', valor: 29, intervalo: 'month' },
  { produto: '500 comandos de IA', chave: 'obras_ia_500', valor: 29, intervalo: null },
]

const produtos = new Map()
async function produto(nome) {
  if (produtos.has(nome)) return produtos.get(nome)
  const achado = (await s.products.search({ query: `name:'${nome}' AND active:'true'` })).data[0]
  const p = achado ?? (await s.products.create({ name: nome }))
  produtos.set(nome, p.id)
  return p.id
}

for (const i of ITENS) {
  const existe = (await s.prices.list({ lookup_keys: [i.chave], active: true, limit: 1 })).data[0]
  if (existe) {
    console.log(`ok   ${i.chave} (${existe.id})`)
    continue
  }
  const preco = await s.prices.create({
    product: await produto(i.produto),
    currency: 'brl',
    unit_amount: i.valor * 100,
    lookup_key: i.chave,
    ...(i.intervalo ? { recurring: { interval: i.intervalo } } : {}),
  })
  console.log(`novo ${i.chave} (${preco.id})`)
}

// Preço de fundador: 30% de desconto para sempre, para os 50 primeiros.
const cupom = await s.coupons.retrieve('FUNDADOR30').catch(() => null)
if (!cupom) {
  await s.coupons.create({ id: 'FUNDADOR30', name: 'Fundador', percent_off: 30, duration: 'forever', max_redemptions: 50 })
  await s.promotionCodes.create({ promotion: { type: 'coupon', coupon: 'FUNDADOR30' }, code: 'FUNDADOR' })
  console.log('novo cupom FUNDADOR30 e código FUNDADOR')
} else {
  console.log('ok   cupom FUNDADOR30')
}
