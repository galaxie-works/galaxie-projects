import type { SupabaseClient } from '@supabase/supabase-js'

// Cota de IA inclusa no plano (padrão Cosmos do Galaxie Sports): cada pedido
// ao assistente reserva 1 comando antes, e depois acerta pelo custo real:
// comandos = maior entre 1 e (custo em US$ ÷ valor de um comando).
// O cliente só vê comandos; tokens e custo ficam no extrato para a Galaxie.
// Quem usa a própria chave de API não gasta cota (ilimitado).

/** Modelo usado com a chave da Galaxie. */
export const MODELO_GALAXIE = 'claude-haiku-5-5'

/** Preço do Claude Haiku 5.5 em US$ por milhão de tokens (até 100 mil de entrada). */
const PRECO_HAIKU = { entrada: 0.1, saida: 0.5, cacheLeitura: 0.01, cacheEscrita: 0.125 }

/**
 * Custo de um comando em US$. Um pedido típico (2 a 3 voltas com ferramentas)
 * fica perto de US$ 0,003, então quase sempre sai 1 comando; pedidos longos
 * contam mais. Com o pacote de 500 por R$ 29, sobra margem mesmo no pior caso.
 */
export const US_POR_COMANDO = 0.004

export interface UsoTokens {
  entrada: number
  saida: number
  cacheLeitura: number
  cacheEscrita: number
}

export const usoVazio = (): UsoTokens => ({ entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 })

export function custoUsd(u: UsoTokens) {
  return (
    (u.entrada * PRECO_HAIKU.entrada +
      u.saida * PRECO_HAIKU.saida +
      u.cacheLeitura * PRECO_HAIKU.cacheLeitura +
      u.cacheEscrita * PRECO_HAIKU.cacheEscrita) /
    1_000_000
  )
}

export function comandosPorCusto(custo: number) {
  return Math.max(1, Math.ceil(custo / US_POR_COMANDO - 1e-9))
}

/** A chave da Galaxie está configurada no servidor? */
export function iaGalaxieDisponivel() {
  return !!process.env.ANTHROPIC_API_KEY
}

export interface Carteira {
  cota_mensal: number
  saldo_plano: number
  saldo_extra: number
  renova_em: string
}

export async function lerCarteira(supabase: SupabaseClient, empresaId: string): Promise<Carteira | null> {
  const { data, error } = await supabase
    .from('ia_carteira')
    .select('cota_mensal, saldo_plano, saldo_extra, renova_em')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) return null
  return (data as Carteira | null) ?? null
}

export interface LancamentoIA {
  id: string
  tipo: 'uso' | 'cota' | 'pacote' | 'ajuste'
  comandos: number
  saldo_depois: number
  descricao: string | null
  created_at: string
}

export async function lerExtrato(supabase: SupabaseClient, empresaId: string, limite = 15) {
  const { data } = await supabase
    .from('ia_extrato')
    .select('id, tipo, comandos, saldo_depois, descricao, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(limite)
  return (data as LancamentoIA[] | null) ?? []
}

export async function reservar(supabase: SupabaseClient, empresaId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('ia_reservar', { p_empresa_id: empresaId, p_comandos: 1 })
  if (error) throw new Error(`Não foi possível ler seus comandos de IA: ${error.message}`)
  return data === true
}

export async function acertar(
  supabase: SupabaseClient,
  empresaId: string,
  uso: UsoTokens,
  descricao: string,
) {
  const custo = custoUsd(uso)
  const { error } = await supabase.rpc('ia_acertar', {
    p_empresa_id: empresaId,
    p_reservado: 1,
    p_real: comandosPorCusto(custo),
    p_modelo: MODELO_GALAXIE,
    p_tokens_entrada: uso.entrada + uso.cacheLeitura + uso.cacheEscrita,
    p_tokens_saida: uso.saida,
    p_custo_usd: Number(custo.toFixed(6)),
    p_descricao: descricao,
  })
  if (error) console.error('ia_acertar', error.message)
}
