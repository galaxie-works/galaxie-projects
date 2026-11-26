import type { FaseCliente, StatusEtapa, StatusProjeto, TemperaturaCliente } from '@/types'

// Variantes do @reui/badge para cada status (estados sempre via -light).
type VarianteBadge =
  | 'primary-light'
  | 'warning-light'
  | 'success-light'
  | 'info-light'
  | 'destructive-light'
  | 'invert-light'

export const VARIANTE_STATUS_PROJETO: Record<StatusProjeto, VarianteBadge> = {
  planejamento: 'info-light',
  em_execucao: 'primary-light',
  pausado: 'warning-light',
  completo: 'success-light',
}

export const VARIANTE_STATUS_ETAPA: Record<StatusEtapa, VarianteBadge> = {
  pendente: 'invert-light',
  em_andamento: 'primary-light',
  concluida: 'success-light',
}

export function projetoAtrasado(p: { data_prazo: string | null; status: StatusProjeto }): boolean {
  if (!p.data_prazo || p.status === 'completo') return false
  return p.data_prazo.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

export const VARIANTE_FASE_CLIENTE: Record<FaseCliente, VarianteBadge> = {
  lead: 'invert-light',
  prospect: 'info-light',
  proposta: 'warning-light',
  cliente: 'primary-light',
  pos_venda: 'success-light',
  inativo: 'destructive-light',
}

export const VARIANTE_TEMPERATURA: Record<TemperaturaCliente, VarianteBadge> = {
  frio: 'info-light',
  morno: 'warning-light',
  quente: 'destructive-light',
}
