import type { SupabaseClient } from '@supabase/supabase-js'
import { DIAS_ALERTA_FASE, PROBABILIDADE_FASE, type FaseNegocio, type Negocio } from '@/types'

export const SELECT_NEGOCIO = '*, clientes(nome, telefone), equipe(nome), projetos(nome, status)'

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

// Valor que vale para o negócio: o fechado, senão o total do orçamento feito
// nele, senão o estimado.
export function valorDoNegocio(n: Negocio): number {
  if (n.valor_fechado != null) return Number(n.valor_fechado)
  const orcamento = Number(n.orcamento_total ?? 0)
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

// Ganhar: o banco cria a obra em planejamento, passa as áreas e itens do
// orçamento para ela e marca o negócio como ganho, tudo junto.
export async function ganharNegocio(
  supabase: SupabaseClient,
  n: Pick<Negocio, 'id'>
): Promise<Resultado & { projetoId?: string }> {
  const { data, error } = await supabase.rpc('ganhar_negocio', { p_negocio_id: n.id })
  if (error) return { error: error.message }
  return { error: null, projetoId: data as string }
}

// Perder: exige motivo (o banco também recusa sem motivo).
export async function perderNegocio(
  supabase: SupabaseClient,
  n: Pick<Negocio, 'id'>,
  motivo: string
): Promise<Resultado> {
  const { error } = await supabase
    .from('negocios')
    .update({ fase: 'perdido', motivo_perda: motivo })
    .eq('id', n.id)
  return { error: error?.message ?? null }
}

// Mover entre fases abertas (ou reabrir um perdido).
export async function moverNegocio(
  supabase: SupabaseClient,
  n: Pick<Negocio, 'id' | 'fase'>,
  fase: FaseNegocio,
  ordem: number
): Promise<Resultado> {
  const { error } = await supabase
    .from('negocios')
    .update({ fase, ordem, ...(n.fase === 'perdido' ? { motivo_perda: null } : {}) })
    .eq('id', n.id)
  return { error: error?.message ?? null }
}
