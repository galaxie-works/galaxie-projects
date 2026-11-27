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
  // Pós-venda
  garantia_meses?: number
  link_avaliacao_google?: string | null
}

export interface MembroEquipe {
  id: string
  empresa_id: string
  nome: string
  /** Profissão (obrigatória nos cadastros novos). */
  funcao: string | null
  /** Telefone profissional. */
  telefone: string | null
  foto_caminho?: string | null
  telefone_pessoal?: string | null
  email?: string | null
  cpf?: string | null
  data_nascimento?: string | null
  cep?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  vinculo?: VinculoEquipe | null
  valor_diaria?: number | null
  chave_pix?: string | null
  data_inicio?: string | null
  contato_emergencia_nome?: string | null
  contato_emergencia_telefone?: string | null
  observacoes?: string | null
  created_at: string
}

export type VinculoEquipe = 'clt' | 'autonomo' | 'mei' | 'empreiteiro' | 'diarista' | 'socio' | 'outro'

export const VINCULO_EQUIPE_LABEL: Record<VinculoEquipe, string> = {
  clt: 'CLT',
  autonomo: 'Autônomo',
  mei: 'MEI',
  empreiteiro: 'Empreiteiro',
  diarista: 'Diarista',
  socio: 'Sócio',
  outro: 'Outro',
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
  // Pós-venda: quem indicou este cliente
  indicado_por_id?: string | null
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

export type TipoAtividade =
  | 'nota'
  | 'ligacao'
  | 'whatsapp'
  | 'visita'
  | 'reuniao'
  | 'email'
  | 'audio'
  | 'tarefa'
  | 'sistema'

export const TIPO_ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  nota: 'Nota',
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  visita: 'Visita',
  reuniao: 'Reunião',
  email: 'E-mail',
  audio: 'Áudio',
  tarefa: 'Tarefa',
  sistema: 'Mudança de fase',
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
  /** Agenda (frente B): prazo do próximo passo. Nulo = contato já feito. */
  previsto_para?: string | null
  concluida_em?: string | null
  resultado?: string | null
  negocio_id?: string | null
  equipe?: { nome: string } | null
}

/** Atividade com prazo (tarefa / próximo passo), com o nome do cliente. */
export type TarefaAgenda = Atividade & {
  previsto_para: string
  clientes?: { nome: string; telefone: string | null } | null
}

// ---------------------------------------------------------------------------
// Financeiro (recebimentos): parcelas que o cliente paga por obra
// ---------------------------------------------------------------------------

export type FormaPagamento = 'pix' | 'boleto' | 'cartao' | 'dinheiro' | 'transferencia'

export const FORMAS_PAGAMENTO: FormaPagamento[] = ['pix', 'transferencia', 'boleto', 'cartao', 'dinheiro']

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
}

export interface Recebimento {
  id: string
  empresa_id: string
  projeto_id: string
  cliente_id: string | null
  descricao: string
  valor: number
  vencimento: string
  recebido_em: string | null
  forma: FormaPagamento | null
  comprovante_url: string | null
  ordem: number
  created_at: string
  // Preenchido via join
  projetos?: { nome: string; cliente_id: string; clientes?: { nome: string } | null } | null
}

// ---------------------------------------------------------------------------
// CRM: pós-venda (garantia, pesquisa, avaliação, revisões, chamados, indicações)
// ---------------------------------------------------------------------------

export type TipoPosVenda = 'garantia' | 'pesquisa' | 'avaliacao' | 'revisao' | 'assistencia' | 'indicacao'

export type StatusPosVenda = 'aberto' | 'agendado' | 'resolvido'

export const TIPO_POS_VENDA_LABEL: Record<TipoPosVenda, string> = {
  garantia: 'Garantia',
  pesquisa: 'Pesquisa',
  avaliacao: 'Avaliação Google',
  revisao: 'Revisão',
  assistencia: 'Assistência',
  indicacao: 'Indicação',
}

export const STATUS_POS_VENDA_LABEL: Record<StatusPosVenda, string> = {
  aberto: 'Aberto',
  agendado: 'Agendado',
  resolvido: 'Resolvido',
}

export interface PosVenda {
  id: string
  empresa_id: string
  cliente_id: string
  projeto_id: string | null
  tipo: TipoPosVenda
  titulo: string
  texto: string | null
  servico_id: string | null
  indicado_cliente_id: string | null
  vence_em: string | null
  status: StatusPosVenda
  nota_0_10: number | null
  resolvido_em: string | null
  created_at: string
  // Joins
  projetos?: { nome: string } | null
  indicado?: { nome: string } | null
}

// ---------------------------------------------------------------------------
// Funil de negócios (fase 2 do CRM)
// ---------------------------------------------------------------------------

export type FaseNegocio =
  | 'novo'
  | 'visita_agendada'
  | 'medicao'
  | 'orcamento_enviado'
  | 'negociacao'
  | 'contrato_assinado'
  | 'ganho'
  | 'perdido'

/** Ordem das colunas do funil. */
export const FASES_NEGOCIO: FaseNegocio[] = [
  'novo',
  'visita_agendada',
  'medicao',
  'orcamento_enviado',
  'negociacao',
  'contrato_assinado',
  'ganho',
  'perdido',
]

export const FASE_NEGOCIO_LABEL: Record<FaseNegocio, string> = {
  novo: 'Novo',
  visita_agendada: 'Visita agendada',
  medicao: 'Medição',
  orcamento_enviado: 'Orçamento enviado',
  negociacao: 'Negociação',
  contrato_assinado: 'Contrato assinado',
  ganho: 'Ganho',
  perdido: 'Perdido',
}

/** Chance de fechar sugerida por fase (%), usada no valor ponderado. */
export const PROBABILIDADE_FASE: Record<FaseNegocio, number> = {
  novo: 10,
  visita_agendada: 20,
  medicao: 35,
  orcamento_enviado: 50,
  negociacao: 70,
  contrato_assinado: 90,
  ganho: 100,
  perdido: 0,
}

/** Dias parado na fase até o cartão ficar em alerta. */
export const DIAS_ALERTA_FASE: Record<FaseNegocio, number | null> = {
  novo: 1,
  visita_agendada: 3,
  medicao: 3,
  orcamento_enviado: 3,
  negociacao: 7,
  contrato_assinado: 7,
  ganho: null,
  perdido: null,
}

export const MOTIVOS_PERDA = [
  'Preço',
  'Prazo',
  'Fechou com concorrente',
  'Desistiu da obra',
  'Sem retorno',
  'Outro',
] as const

export interface Negocio {
  id: string
  empresa_id: string
  cliente_id: string
  titulo: string
  fase: FaseNegocio
  valor_estimado: number | null
  /** Soma do orçamento por área feito no negócio. */
  orcamento_total: number
  valor_fechado: number | null
  probabilidade: number | null
  previsao_fechamento: string | null
  motivo_perda: string | null
  responsavel_id: string | null
  projeto_id: string | null
  ordem: number
  fase_alterada_em: string
  fechado_em: string | null
  created_at: string
  clientes?: { nome: string; telefone: string | null } | null
  equipe?: { nome: string } | null
  projetos?: { nome: string; status: StatusProjeto } | null
}
