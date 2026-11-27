import { SERVICOS_POR_ID } from '@/lib/servicos'
import type { PosVenda } from '@/types'

// Select padrão do pós-venda, com nome da obra e do cliente indicado.
export const SELECT_POS_VENDA =
  '*, projetos(nome), indicado:clientes!pos_venda_indicado_cliente_id_fkey(nome)'

export type SituacaoPosVenda = 'resolvido' | 'atrasado' | 'hoje' | 'agendado' | 'aberto' | 'vigente' | 'vencida'

// Situação para o selo: garantia é vigente/vencida; o resto segue status e prazo.
export function situacaoPosVenda(item: Pick<PosVenda, 'tipo' | 'status' | 'vence_em'>, hoje: string): SituacaoPosVenda {
  if (item.tipo === 'garantia' && item.status !== 'resolvido') {
    return item.vence_em && item.vence_em.slice(0, 10) < hoje ? 'vencida' : 'vigente'
  }
  if (item.status === 'resolvido') return 'resolvido'
  const d = item.vence_em?.slice(0, 10)
  if (d && d < hoje) return 'atrasado'
  if (d === hoje) return 'hoje'
  return item.status === 'agendado' ? 'agendado' : 'aberto'
}

export const SITUACAO_POS_VENDA: Record<
  SituacaoPosVenda,
  { rotulo: string; variante: 'success-light' | 'destructive-light' | 'warning-light' | 'info-light' | 'invert-light' | 'primary-light' }
> = {
  resolvido: { rotulo: 'Resolvido', variante: 'success-light' },
  atrasado: { rotulo: 'Atrasado', variante: 'destructive-light' },
  hoje: { rotulo: 'Hoje', variante: 'warning-light' },
  agendado: { rotulo: 'Agendado', variante: 'info-light' },
  aberto: { rotulo: 'Aberto', variante: 'invert-light' },
  vigente: { rotulo: 'Vigente', variante: 'primary-light' },
  vencida: { rotulo: 'Vencida', variante: 'invert-light' },
}

export function tituloPosVenda(item: Pick<PosVenda, 'tipo' | 'titulo' | 'servico_id'>): string {
  if (item.tipo === 'revisao' && item.servico_id) {
    const nome = SERVICOS_POR_ID[item.servico_id]?.servico.nome
    if (nome) return `Revisão: ${nome}`
  }
  return item.titulo
}

// Pendentes primeiro (por prazo), garantias vigentes depois, resolvidos no fim.
export function ordenarPosVenda(itens: PosVenda[]): PosVenda[] {
  const peso = (i: PosVenda) => (i.status === 'resolvido' ? 2 : i.tipo === 'garantia' ? 1 : 0)
  return [...itens].sort((a, b) => {
    const p = peso(a) - peso(b)
    if (p !== 0) return p
    if (peso(a) === 2) return (b.resolvido_em ?? b.created_at).localeCompare(a.resolvido_em ?? a.created_at)
    return (a.vence_em ?? '9999').localeCompare(b.vence_em ?? '9999')
  })
}

export function pendentesPosVenda(itens: PosVenda[]): number {
  return itens.filter((i) => i.status !== 'resolvido' && i.tipo !== 'garantia').length
}

// Média das notas (0 a 10) das pesquisas respondidas.
export function mediaNotas(itens: PosVenda[]): number | null {
  const notas = itens.filter((i) => i.tipo === 'pesquisa' && i.nota_0_10 != null).map((i) => i.nota_0_10 as number)
  if (notas.length === 0) return null
  return notas.reduce((s, n) => s + n, 0) / notas.length
}

export function mensagemAvaliacao(nomeCliente: string, link: string | null): string {
  const primeiro = nomeCliente.split(' ')[0]
  return link
    ? `Olá, ${primeiro}! Obrigado por confiar no nosso trabalho. Se puder, deixe sua avaliação no Google, ajuda muito: ${link}`
    : `Olá, ${primeiro}! Obrigado por confiar no nosso trabalho. Se puder, deixe sua avaliação no Google, ajuda muito.`
}

export function mensagemPesquisa(nomeCliente: string): string {
  const primeiro = nomeCliente.split(' ')[0]
  return `Olá, ${primeiro}! Como ficou a obra? De 0 a 10, quanto você recomendaria nosso trabalho para um amigo?`
}

