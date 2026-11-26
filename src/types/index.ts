// Tipos TypeScript que espelham o schema do banco (ver supabase/schema.sql)

import type { Unidade } from '@/lib/orcamento'

export type StatusProjeto =
  | 'planejamento'
  | 'em_execucao'
  | 'pausado'
  | 'completo'

export type StatusEtapa = 'pendente' | 'em_andamento' | 'concluida'

export type TipoCliente = 'PF' | 'PJ'

export interface Empresa {
  id: string
  owner_id: string
  nome: string
  cnpj: string | null
  descricao: string | null
  modo_operacao: string | null
  servicos: string[]
  created_at: string
}

export interface MembroEquipe {
  id: string
  empresa_id: string
  nome: string
  funcao: string | null
  telefone: string | null
  created_at: string
}

export interface Cliente {
  id: string
  empresa_id: string
  tipo: TipoCliente
  nome: string
  cpf: string | null
  cnpj: string | null
  razao_social: string | null
  email: string | null
  telefone: string | null
  endereco: string | null
  created_at: string
}

export interface Projeto {
  id: string
  empresa_id: string
  cliente_id: string
  nome: string
  status: StatusProjeto
  percentual_conclusao: number
  data_inicio: string | null
  data_prazo: string | null
  orcamento_total: number | null
  created_at: string
  // Preenchido via join, não existe na tabela
  clientes?: { nome: string } | null
}

export interface Etapa {
  id: string
  projeto_id: string
  nome: string
  responsavel_id: string | null
  status: StatusEtapa
  data_prazo: string | null
  ordem: number
  created_at: string
  equipe?: { nome: string } | null
}

export interface Compra {
  id: string
  projeto_id: string
  descricao: string
  valor: number
  responsavel_id: string | null
  data: string | null
  created_at: string
  equipe?: { nome: string } | null
}

export const STATUS_PROJETO_LABEL: Record<StatusProjeto, string> = {
  planejamento: 'Planejamento',
  em_execucao: 'Em execução',
  pausado: 'Pausado',
  completo: 'Completo',
}

export const STATUS_ETAPA_LABEL: Record<StatusEtapa, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
}

export type { Unidade }

// Linha de precos_servicos: preço e unidade de cobrança de cada serviço.
export interface PrecoServicoLinha {
  empresa_id: string
  servico_id: string
  unidade: Unidade
  preco: number
  updated_at: string
}

export interface ProjetoArea {
  id: string
  projeto_id: string
  nome: string
  observacao: string | null
  ordem: number
  created_at: string
}

export interface ProjetoItem {
  id: string
  area_id: string
  projeto_id: string
  servico_id: string | null
  descricao: string | null
  unidade: Unidade
  quantidade: number
  memoria_calculo: string | null
  preco_unitario: number
  total: number
  ordem: number
  created_at: string
}
