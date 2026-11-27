import { NextResponse } from 'next/server'
import { lerConfig } from '@/lib/plataforma/config'
import { precoPorChave, stripe, urlApp } from '@/lib/stripe/servidor'
import { empresaLogada, garantirClienteStripe } from '@/lib/stripe/cliente-empresa'

// Compra avulsa de 500 comandos de IA. Os comandos só entram quando o Stripe
// confirma o pagamento no webhook (Pix pode levar alguns minutos).
export async function POST(request: Request) {
  const s = await stripe()
  if (!s) return NextResponse.json({ erro: 'A cobrança online ainda não está ligada.' }, { status: 503 })

  const dados = await empresaLogada()
  if (!dados) return NextResponse.json({ erro: 'Entre na sua conta.' }, { status: 401 })

  const base = urlApp(request)
  const PACOTE_IA = (await lerConfig()).pacoteIA
  try {
    const preco = await precoPorChave(s, PACOTE_IA.lookupKey)
    if (!preco) {
      return NextResponse.json({ erro: 'O pacote ainda não foi cadastrado no Stripe.' }, { status: 503 })
    }
    const cliente = await garantirClienteStripe(s, dados)
    const metadata = {
      empresa_id: dados.empresa.id,
      tipo: 'pacote_ia',
      comandos: String(PACOTE_IA.comandos),
    }
    const sessao = await s.checkout.sessions.create({
      mode: 'payment',
      customer: cliente,
      line_items: [{ price: preco.id, quantity: 1 }],
      locale: 'pt-BR',
      client_reference_id: dados.empresa.id,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${base}/assinatura?pacote=1`,
      cancel_url: `${base}/assinatura`,
    })
    return NextResponse.json({ url: sessao.url })
  } catch (e) {
    console.error('stripe pacote', e)
    return NextResponse.json({ erro: 'Não foi possível abrir o pagamento. Tente de novo.' }, { status: 502 })
  }
}
