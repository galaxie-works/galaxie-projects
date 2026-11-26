// Leitura e gravação do orçamento no Supabase (funciona com o cliente do
// navegador e com o do servidor).

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  doBanco,
  limparOrcamento,
  paraBanco,
  type AreaOrcamento,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'

export async function carregarPrecos(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<TabelaPrecos> {
  const { data } = await supabase
    .from('precos_servicos')
    .select('servico_id, unidade, preco')
    .eq('empresa_id', empresaId)
  const tabela: TabelaPrecos = {}
  for (const p of (data ?? []) as {
    servico_id: string
    unidade: Unidade
    preco: number | string
  }[])
    tabela[p.servico_id] = { unidade: p.unidade, preco: Number(p.preco) }
  return tabela
}

export async function carregarOrcamento(
  supabase: SupabaseClient,
  projetoId: string,
): Promise<AreaOrcamento[]> {
  const [{ data: areas }, { data: itens }] = await Promise.all([
    supabase.from('projeto_areas').select('*').eq('projeto_id', projetoId),
    supabase.from('projeto_itens').select('*').eq('projeto_id', projetoId),
  ])
  return doBanco(areas ?? [], itens ?? [])
}

/**
 * Grava áreas e itens (substitui os anteriores) e devolve o novo total.
 * Serviços que ainda não tinham preço na tabela da empresa ganham o preço
 * usado aqui, para vir preenchido no próximo orçamento.
 */
export async function salvarOrcamento(
  supabase: SupabaseClient,
  {
    projetoId,
    empresaId,
    areas,
    precos,
  }: {
    projetoId: string
    empresaId: string
    areas: AreaOrcamento[]
    precos: TabelaPrecos
  },
): Promise<{ total: number | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('salvar_orcamento', {
    p_projeto_id: projetoId,
    p_areas: paraBanco(areas),
  })
  if (error) return { total: null, erro: error.message }

  const novos = new Map<
    string,
    { empresa_id: string; servico_id: string; unidade: Unidade; preco: number }
  >()
  for (const a of limparOrcamento(areas))
    for (const i of a.itens)
      if (i.servico_id && !precos[i.servico_id] && i.preco_unitario > 0 && !novos.has(i.servico_id))
        novos.set(i.servico_id, {
          empresa_id: empresaId,
          servico_id: i.servico_id,
          unidade: i.unidade,
          preco: i.preco_unitario,
        })
  if (novos.size > 0) {
    // Falha aqui não invalida o orçamento salvo; só não memoriza o preço.
    await supabase.from('precos_servicos').upsert([...novos.values()], { ignoreDuplicates: true })
  }
  return { total: Number(data ?? 0), erro: null }
}
