import { NextResponse } from 'next/server'
import { stripe, urlApp } from '@/lib/stripe/servidor'
import { empresaLogada } from '@/lib/stripe/cliente-empresa'

// Portal do Stripe: trocar cartão, plano, ver faturas e cancelar.
export async function POST(request: Request) {
  const s = await stripe()
  if (!s) return NextResponse.json({ erro: 'A cobrança online ainda não está ligada.' }, { status: 503 })

  const dados = await empresaLogada()
  if (!dados) return NextResponse.json({ erro: 'Entre na sua conta.' }, { status: 401 })
  const cliente = dados.assinatura?.gateway_cliente_id
  if (!cliente) return NextResponse.json({ erro: 'Você ainda não tem pagamento cadastrado.' }, { status: 400 })

  try {
    const portal = await s.billingPortal.sessions.create({
      customer: cliente,
      return_url: `${urlApp(request)}/assinatura`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (e) {
    console.error('stripe portal', e)
    return NextResponse.json({ erro: 'Não foi possível abrir o portal. Tente de novo.' }, { status: 502 })
  }
}
