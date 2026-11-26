import type { StatusEtapa, StatusProjeto } from '@/types'

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
