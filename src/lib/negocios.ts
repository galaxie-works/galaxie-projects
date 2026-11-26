import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_ALERTA_FASE, PROBABILIDADE_FASE, type FaseNegocio, type Negocio } from '@/types'

export const SELECT_NEGOCIO = '*, clientes(nome, telefone), equipe(nome), projetos(nome, status, orcamento_total)'

export const FASES_ABERTAS: FaseNegocio[] = [
  'novo',
  'visita_agendada',
  'medicao',
  'orcamento_enviado',
  'negociacao',
  'contrato_assinado',
]

export function negocioAberto(n: Pick<Negocio, 'fase'>): boolean {
  return FASES_ABERTAS.includes(n.fase)
}

// Valor que vale para o negócio: o fechado, senão o orçamento da obra ligada,
// senão o estimado.
export function valorDoNegocio(n: Negocio): number {
  if (n.valor_fechado != null) return Number(n.valor_fechado)
  const orcamento = Number(n.projetos?.orcamento_total ?? 0)
  if (orcamento > 0) return orcamento
  return Number(n.valor_estimado ?? 0)
}

export function probabilidadeDoNegocio(n: Pick<Negocio, 'fase' | 'probabilidade'>): number {
  return n.probabilidade ?? PROBABILIDADE_FASE[n.fase]
}

/** Dias inteiros desde a última mudança de fase. */
export function diasNaFase(n: Pick<Negocio, 'fase_alterada_em'>, agora = Date.now()): number {
  return Math.max(0, Math.floor((agora - new Date(n.fase_alterada_em).getTime()) / 86_400_000))
}

export function negocioParado(n: Negocio, agora = Date.now()): boolean {
  const limite = DIAS_ALERTA_FASE[n.fase]
  return limite != null && diasNaFase(n, agora) > limite
}

type Resultado = { error: string | null }

// Ganhar: garante uma obra ligada (cria em planejamento se não houver) e
// grava o valor fechado. A obra segue em planejamento até começar.
export async function ganharNegocio(supabase: SupabaseClient, n: Negocio): Promise<Resultado & { projetoId?: string }> {
  let projetoId = n.projeto_id
  if (!projetoId) {
    const { data, error } = await supabase
      .from('projetos')
      .insert({
        empresa_id: n.empresa_id,
        cliente_id: n.cliente_id,
        nome: n.titulo,
        status: 'planejamento',
        orcamento_total: n.valor_estimado ?? 0,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Não foi possível criar a obra' }
    projetoId = data.id as string
  } else if (n.projetos?.status === 'cancelado') {
    const { error } = await supabase.from('projetos').update({ status: 'planejamento' }).eq('id', projetoId)
    if (error) return { error: error.message }
  }
  const { error } = await supabase
    .from('negocios')
    .update({ fase: 'ganho', projeto_id: projetoId, valor_fechado: valorDoNegocio(n) || null, motivo_perda: null })
    .eq('id', n.id)
  return { error: error?.message ?? null, projetoId }
}

// Perder: exige motivo; a obra em planejamento ligada vira cancelada.
export async function perderNegocio(supabase: SupabaseClient, n: Negocio, motivo: string): Promise<Resultado> {
  const { error } = await supabase
    .from('negocios')
    .update({ fase: 'perdido', motivo_perda: motivo })
    .eq('id', n.id)
  if (error) return { error: error.message }
  if (n.projeto_id && n.projetos?.status === 'planejamento') {
    const { error: e2 } = await supabase.from('projetos').update({ status: 'cancelado' }).eq('id', n.projeto_id)
    if (e2) return { error: e2.message }
  }
  return { error: null }
}

// Reabrir ou mover entre fases abertas. Saindo de perdido, a obra cancelada
// volta para planejamento.
export async function moverNegocio(
  supabase: SupabaseClient,
  n: Negocio,
  fase: FaseNegocio,
  ordem: number
): Promise<Resultado> {
  const { error } = await supabase
    .from('negocios')
    .update({ fase, ordem, ...(n.fase === 'perdido' ? { motivo_perda: null } : {}) })
    .eq('id', n.id)
  if (error) return { error: error.message }
  if (n.fase === 'perdido' && n.projeto_id && n.projetos?.status === 'cancelado') {
    const { error: e2 } = await supabase.from('projetos').update({ status: 'planejamento' }).eq('id', n.projeto_id)
    if (e2) return { error: e2.message }
  }
  return { error: null }
}

// Orçamento do negócio: mora numa obra em planejamento ligada a ele.
export async function obraDoOrcamento(supabase: SupabaseClient, n: Negocio): Promise<Resultado & { projetoId?: string }> {
  if (n.projeto_id) return { error: null, projetoId: n.projeto_id }
  const { data, error } = await supabase
    .from('projetos')
    .insert({
      empresa_id: n.empresa_id,
      cliente_id: n.cliente_id,
      nome: n.titulo,
      status: 'planejamento',
      orcamento_total: 0,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Não foi possível criar a obra' }
  const projetoId = data.id as string
  const { error: e2 } = await supabase.from('negocios').update({ projeto_id: projetoId }).eq('id', n.id)
  return { error: e2?.message ?? null, projetoId }
}
