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
  // CRM (fase 1)
  fase_manual: FaseCliente | null
  temperatura: TemperaturaCliente | null
  origem: string | null
  responsavel_id: string | null
  tags: string[]
  proximo_followup_em: string | null
  observacoes: string | null
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

// ---------------------------------------------------------------------------
// CRM: fase do cliente, temperatura, atividades e resumo do painel
// ---------------------------------------------------------------------------

export type FaseCliente = 'lead' | 'prospect' | 'proposta' | 'cliente' | 'pos_venda' | 'inativo'

export const FASES_CLIENTE: FaseCliente[] = [
  'lead',
  'prospect',
  'proposta',
  'cliente',
  'pos_venda',
  'inativo',
]

export const FASE_CLIENTE_LABEL: Record<FaseCliente, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  proposta: 'Proposta',
  cliente: 'Cliente',
  pos_venda: 'Pós-venda',
  inativo: 'Inativo',
}

export type TemperaturaCliente = 'frio' | 'morno' | 'quente'

export const TEMPERATURA_LABEL: Record<TemperaturaCliente, string> = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
}

export const ORIGENS_CLIENTE = [
  'Indicação',
  'Instagram',
  'Google',
  'Site',
  'Loja',
  'Arquiteto',
  'Outro',
] as const

export type TipoAtividade = 'nota' | 'ligacao' | 'whatsapp' | 'visita' | 'reuniao' | 'email' | 'audio'

export const TIPO_ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  nota: 'Nota',
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  visita: 'Visita',
  reuniao: 'Reunião',
  email: 'E-mail',
  audio: 'Áudio',
}

export interface Atividade {
  id: string
  empresa_id: string
  cliente_id: string
  projeto_id: string | null
  tipo: TipoAtividade
  texto: string
  responsavel_id: string | null
  ocorreu_em: string
  created_at: string
  equipe?: { nome: string } | null
}
