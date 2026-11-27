import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clienteAdmin } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/servidor'
import { lerLookupKey } from '@/lib/planos'
import { planoPorId } from '@/lib/plataforma/config'
import { lerSegredo } from '@/lib/plataforma/segredos'

// Webhook do Stripe. Única porta por onde a assinatura muda e por onde entram
// comandos de IA comprados. Cada evento é processado uma vez (stripe_eventos);
// se o processamento falhar, o registro sai e o Stripe tenta de novo.

const STATUS: Partial<Record<Stripe.Subscription.Status, string>> = {
  active: 'ativa',
  trialing: 'ativa',
  past_due: 'atrasada',
  unpaid: 'atrasada',
  canceled: 'cancelada',
  incomplete_expired: 'cancelada',
  paused: 'cancelada',
}

const idDe = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id ?? null)

async function empresaDaAssinatura(s: Stripe, db: SupabaseClient, sub: Stripe.Subscription) {
  if (sub.metadata?.empresa_id) return sub.metadata.empresa_id
  const cliente = idDe(sub.customer)
  const { data } = await db.from('assinaturas').select('empresa_id').eq('gateway_cliente_id', cliente).maybeSingle()
  if (data?.empresa_id) return data.empresa_id as string
  if (!cliente) return null
  const c = await s.customers.retrieve(cliente)
  return 'deleted' in c && c.deleted ? null : (c.metadata?.empresa_id ?? null)
}

async function sincronizarAssinatura(s: Stripe, db: SupabaseClient, sub: Stripe.Subscription) {
  const empresaId = await empresaDaAssinatura(s, db, sub)
  if (!empresaId) throw new Error(`Assinatura ${sub.id} sem empresa_id`)

  const status = STATUS[sub.status]
  // incomplete: primeiro pagamento ainda pendente; nada muda até confirmar.
  if (!status) return

  const item = sub.items.data[0]
  const chave = lerLookupKey(item?.price.lookup_key)
  const plano = await planoPorId(chave?.plano ?? sub.metadata?.plano)
  // Atrasada: vale até onde foi pago (início do período em aberto), não até o
  // fim do período que ainda não foi pago; a tolerância de 7 dias conta daí.
  const fimSeg =
    sub.status === 'canceled'
      ? (sub.ended_at ?? item?.current_period_end)
      : status === 'atrasada'
        ? item?.current_period_start
        : item?.current_period_end

  const { error } = await db
    .from('assinaturas')
    .update({
      status,
      plano: plano?.id ?? 'teste',
      ciclo: chave?.ciclo ?? (sub.metadata?.ciclo === 'anual' ? 'anual' : 'mensal'),
      stripe_preco: item?.price.id ?? null,
      periodo_fim: fimSeg ? new Date(fimSeg * 1000).toISOString() : null,
      cancela_no_fim: !!(sub.cancel_at_period_end || sub.cancel_at),
      gateway: 'stripe',
      gateway_cliente_id: idDe(sub.customer),
      gateway_assinatura_id: sub.id,
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', empresaId)
  if (error) throw new Error(error.message)

  if (plano && (status === 'ativa' || status === 'atrasada')) {
    const { error: e2 } = await db.rpc('ia_definir_cota', { p_empresa_id: empresaId, p_cota: plano.comandosIA })
    if (e2) throw new Error(e2.message)
  }
}

async function creditarPacote(db: SupabaseClient, sessao: Stripe.Checkout.Session) {
  if (sessao.metadata?.tipo !== 'pacote_ia' || sessao.payment_status !== 'paid') return
  const empresaId = sessao.metadata.empresa_id
  const comandos = Number(sessao.metadata.comandos)
  if (!empresaId || !Number.isInteger(comandos) || comandos < 1) throw new Error(`Pacote ${sessao.id} sem dados`)
  const { error } = await db.rpc('ia_creditar_pacote', {
    p_empresa_id: empresaId,
    p_comandos: comandos,
    p_referencia: idDe(sessao.payment_intent) ?? sessao.id,
  })
  if (error) throw new Error(error.message)
}

async function processar(s: Stripe, db: SupabaseClient, evento: Stripe.Event) {
  switch (evento.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const sessao = evento.data.object
      if (sessao.mode === 'payment') return creditarPacote(db, sessao)
      const subId = idDe(sessao.subscription)
      if (subId) return sincronizarAssinatura(s, db, await s.subscriptions.retrieve(subId))
      return
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // Lê de novo: eventos podem chegar fora de ordem.
      return sincronizarAssinatura(s, db, await s.subscriptions.retrieve(evento.data.object.id))
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subId = idDe(evento.data.object.parent?.subscription_details?.subscription)
      if (subId) return sincronizarAssinatura(s, db, await s.subscriptions.retrieve(subId))
      return
    }
  }
}

export async function POST(request: Request) {
  const s = await stripe()
  const segredo = await lerSegredo('STRIPE_WEBHOOK_SECRET')
  const db = clienteAdmin()
  if (!s || !segredo || !db) return NextResponse.json({ erro: 'Cobrança não configurada.' }, { status: 503 })

  const assinatura = request.headers.get('stripe-signature')
  if (!assinatura) return NextResponse.json({ erro: 'Sem assinatura.' }, { status: 400 })

  let evento: Stripe.Event
  try {
    evento = await s.webhooks.constructEventAsync(await request.text(), assinatura, segredo)
  } catch {
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 400 })
  }

  const { error: dup } = await db.from('stripe_eventos').insert({ id: evento.id, tipo: evento.type })
  if (dup) {
    if (dup.code === '23505') return NextResponse.json({ ok: true, repetido: true })
    return NextResponse.json({ erro: dup.message }, { status: 500 })
  }

  try {
    await processar(s, db, evento)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('stripe webhook', evento.type, e)
    await db.from('stripe_eventos').delete().eq('id', evento.id)
    return NextResponse.json({ erro: 'Falha ao processar.' }, { status: 500 })
  }
}
