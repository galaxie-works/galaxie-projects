import type { EnderecoNacional } from './dps'

export type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erro: string; dados?: T }

export type EmpresaFiscal = {
  empresa_id: string
  razao_social: string | null
  cnpj: string | null
  inscricao_municipal: string | null
  opcao_simples: '1' | '2' | '3'
  regime_apuracao_simples: '1' | '2' | '3' | null
  regime_especial: string
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  codigo_municipio: string | null
  telefone: string | null
  email: string | null
  codigo_tributacao_nacional: string
  codigo_tributacao_municipal: string | null
  codigo_nbs: string | null
  aliquota_iss: number | null
  iss_retido: boolean
  percentual_tributos_simples: number | null
  descricao_padrao: string | null
  ibscbs_ind_op: string | null
  ibscbs_cst: string
  ibscbs_class_trib: string
  ibscbs_sempre: boolean
  ambiente: 'homologacao' | 'producao'
  serie: string
  proximo_numero_homologacao: number
  proximo_numero_producao: number
}

export type CertificadoPublico = {
  titular: string | null
  documento: string | null
  valido_ate: string | null
  enviado_em: string
}

export type TomadorNota = {
  documento: string
  nome: string
  email?: string | null
  telefone?: string | null
  endereco?: (EnderecoNacional & { cidade?: string; uf?: string }) | null
}

export type ObraNota = {
  cno?: string | null
  endereco?: {
    cep: string
    logradouro: string
    numero: string
    complemento?: string | null
    bairro: string
    codigoMunicipio?: string | null
    cidade?: string
    uf?: string
  } | null
}

export type DadosEmissao = {
  projetoId?: string | null
  clienteId?: string | null
  recebimentoId?: string | null
  valor: number
  descricao: string
  informacoes?: string | null
  competencia?: string | null
  tomador: TomadorNota
  obra?: ObraNota | null
}

export type StatusNota = 'processando' | 'autorizada' | 'rejeitada' | 'cancelada' | 'erro_envio'

export type NotaFiscal = {
  id: string
  projeto_id: string | null
  cliente_id: string | null
  recebimento_id: string | null
  ambiente: 'homologacao' | 'producao'
  serie: string
  numero_dps: number
  status: StatusNota
  valor: number
  descricao: string
  competencia: string
  tomador: TomadorNota
  chave_acesso: string | null
  numero_nfse: string | null
  mensagens: { codigo?: string; descricao?: string; mensagem?: string; complemento?: string }[]
  autorizada_em: string | null
  cancelada_em: string | null
  created_at: string
}

export const ROTULO_STATUS: Record<StatusNota, string> = {
  processando: 'Processando',
  autorizada: 'Autorizada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  erro_envio: 'Sem resposta',
}
