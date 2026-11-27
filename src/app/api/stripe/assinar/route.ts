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

    const assinaturaAtual = dados.assinatura?.gateway_assinatura_id
    if (assinaturaAtual && ['ativa', 'atrasada'].includes(dados.assinatura?.status ?? '')) {
      const portal = await s.billingPortal.sessions.create({
        customer: cliente,
        return_url: `${base}/assinatura`,
      })
      return NextResponse.json({ url: portal.url })
    }

    const preco = await precoPorChave(s, lookupKey(plano.id, ciclo))
    if (!preco) {
      return NextResponse.json({ erro: 'Esse plano ainda não foi cadastrado no Stripe.' }, { status: 503 })
    }

    // Quem assina durante o teste não perde os dias que faltam.
    const fimTeste = dados.assinatura?.status === 'teste' ? Date.parse(dados.assinatura.teste_fim) : NaN
    const trialEnd =
      Number.isFinite(fimTeste) && fimTeste - Date.now() > DOIS_DIAS ? Math.floor(fimTeste / 1000) : undefined

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
