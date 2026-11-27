import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { clienteAdmin } from '@/lib/supabase/admin'

// Empresa de quem está logado e o cliente dela no Stripe (criado na primeira compra).

export async function empresaLogada() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) return null
  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('status, plano, teste_fim, gateway_cliente_id, gateway_assinatura_id')
    .eq('empresa_id', empresa.id)
    .maybeSingle()
  return { supabase, user, empresa, assinatura }
}

export async function garantirClienteStripe(
  s: Stripe,
  dados: NonNullable<Awaited<ReturnType<typeof empresaLogada>>>,
): Promise<string> {
  const existente = dados.assinatura?.gateway_cliente_id
  if (existente) return existente

  // Pode já existir (compra anterior cujo id não foi salvo).
  const achados = await s.customers.search({
    query: `metadata['empresa_id']:'${dados.empresa.id}'`,
    limit: 1,
  })
  const cliente =
    achados.data[0] ??
    (await s.customers.create({
      name: dados.empresa.nome,
      email: dados.user.email || undefined,
      metadata: { empresa_id: dados.empresa.id, tipo_pessoa: dados.empresa.tipo_pessoa ?? 'PJ' },
    }))

  await clienteAdmin()
    ?.from('assinaturas')
    .update({ gateway: 'stripe', gateway_cliente_id: cliente.id, updated_at: new Date().toISOString() })
    .eq('empresa_id', dados.empresa.id)
  return cliente.id
}
