import { NextResponse } from 'next/server'
import { lookupKey, planoPorId, type Ciclo } from '@/lib/planos'
import { precoPorChave, stripe, urlApp } from '@/lib/stripe/servidor'
import { empresaLogada, garantirClienteStripe } from '@/lib/stripe/cliente-empresa'

const DOIS_DIAS = 2 * 24 * 60 * 60 * 1000

// Abre o checkout do Stripe para assinar um plano. Quem já tem assinatura
// paga vai para o portal (trocar de plano lá não duplica a cobrança).
export async function POST(request: Request) {
  const s = stripe()
  if (!s) return NextResponse.json({ erro: 'A cobrança online ainda não está ligada.' }, { status: 503 })

  const dados = await empresaLogada()
  if (!dados) return NextResponse.json({ erro: 'Entre na sua conta.' }, { status: 401 })

  const corpo = (await request.json().catch(() => ({}))) as { plano?: string; ciclo?: string }
  const plano = planoPorId(corpo.plano)
  const ciclo: Ciclo = corpo.ciclo === 'anual' ? 'anual' : 'mensal'
  if (!plano) return NextResponse.json({ erro: 'Plano inválido.' }, { status: 400 })

  const base = urlApp(request)
  try {
    const cliente = await garantirClienteStripe(s, dados)

    // Já tem assinatura no Stripe (mesmo que o webhook ainda não tenha chegado):
    // trocar de plano vai pelo portal, para não cobrar duas vezes.
    const existentes = await s.subscriptions.list({ customer: cliente, status: 'all', limit: 10 })
    const viva = existentes.data.find((x) =>
      ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(x.status),
    )
    if (viva || (dados.assinatura?.gateway_assinatura_id && ['ativa', 'atrasada'].includes(dados.assinatura?.status ?? ''))) {
      const portal = await s.billingPortal.sessions.create({
        customer: cliente,
        return_url: `${base}/assinatura`,
      })
      return NextResponse.json({ url: portal.url })
    }

    // Um checkout aberto por vez: o anterior (outra aba, tentativa antiga) expira.
    const abertos = await s.checkout.sessions.list({ customer: cliente, status: 'open', limit: 10 })
    for (const sessao of abertos.data) {
      if (sessao.mode === 'subscription') await s.checkout.sessions.expire(sessao.id).catch(() => null)
    }

    const preco = await precoPorChave(s, lookupKey(plano.id, ciclo))
    if (!preco) {
      return NextResponse.json({ erro: 'Esse plano ainda não foi cadastrado no Stripe.' }, { status: 503 })
    }

    // Quem assina durante o teste não perde os dias que faltam. O Stripe exige
    // pelo menos 48 h de teste; nos últimos dois dias, ganha o que faltar.
    const fimTeste = dados.assinatura?.status === 'teste' ? Date.parse(dados.assinatura.teste_fim) : NaN
    const trialEnd =
      Number.isFinite(fimTeste) && fimTeste > Date.now()
        ? Math.ceil(Math.max(fimTeste, Date.now() + DOIS_DIAS + 60_000) / 1000)
        : undefined

    const sessao = await s.checkout.sessions.create({
      mode: 'subscription',
      customer: cliente,
      line_items: [{ price: preco.id, quantity: 1 }],
      allow_promotion_codes: true,
      locale: 'pt-BR',
      client_reference_id: dados.empresa.id,
      metadata: { empresa_id: dados.empresa.id, plano: plano.id, ciclo },
      subscription_data: {
        metadata: { empresa_id: dados.empresa.id, plano: plano.id, ciclo },
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
      success_url: `${base}/assinatura?pago=1`,
      cancel_url: `${base}/assinatura`,
    })
    return NextResponse.json({ url: sessao.url })
  } catch (e) {
    console.error('stripe assinar', e)
    return NextResponse.json({ erro: 'Não foi possível abrir o pagamento. Tente de novo.' }, { status: 502 })
  }
}
