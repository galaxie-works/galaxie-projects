import type { FormaPagamento, StatusEtapa, StatusPosVenda, StatusProjeto, TipoPosVenda } from '@/types'

// Dados que a função portal_dados (Supabase) devolve para o link do cliente.
// Só o que o cliente final pode ver: nada de custo, compra ou nota interna.
export type PortalDados = {
  empresa: { nome: string; garantia_meses: number | null; link_avaliacao_google: string | null }
  cliente: { nome: string }
  obras: PortalObra[]
  arquivos: PortalArquivo[]
  pos_venda: PortalPosVenda[]
}

export type PortalObra = {
  id: string
  nome: string
  status: StatusProjeto
  percentual_conclusao: number
  data_inicio: string | null
  data_prazo: string | null
  orcamento_total: number | null
  etapas: { id: string; nome: string; status: StatusEtapa; data_prazo: string | null }[]
  recebimentos: {
    id: string
    descricao: string
    valor: number
    vencimento: string
    recebido_em: string | null
    forma: FormaPagamento | null
  }[]
  notas: {
    id: string
    numero_nfse: string | null
    chave_acesso: string | null
    valor: number
    descricao: string
    competencia: string
    autorizada_em: string | null
    ambiente: 'homologacao' | 'producao'
  }[]
}

export type PortalArquivo = {
  id: string
  projeto_id: string | null
  nome: string
  caminho: string
  tipo_mime: string | null
  created_at: string
  /** URL assinada pelo servidor (1 hora). */
  url?: string
}

export type PortalPosVenda = {
  id: string
  projeto_id: string | null
  tipo: Extract<TipoPosVenda, 'garantia' | 'revisao' | 'assistencia'>
  titulo: string
  texto: string | null
  vence_em: string | null
  status: StatusPosVenda
  origem: 'interno' | 'portal'
  resolvido_em: string | null
  created_at: string
}

export type PortalAcesso = {
  id: string
  cliente_id: string
  token: string
  created_at: string
  revogado_em: string | null
  ultimo_acesso_em: string | null
  acessos: number
}

/** Endereço do portal para mandar ao cliente. */
export function linkPortal(token: string, origem: string): string {
  return `${origem.replace(/\/$/, '')}/portal/${token}`
}

export function mensagemPortal(nomeCliente: string, empresa: string, link: string): string {
  const primeiro = nomeCliente.trim().split(/\s+/)[0] || ''
  return (
    `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é da ${empresa}. ` +
    `Por este link você acompanha a sua obra: andamento, fotos, parcelas, notas fiscais e garantia. ` +
    `Se precisar de assistência, é só abrir um chamado por lá.\n\n${link}`
  )
}

/** Token no formato que o banco gera (64 caracteres hexadecimais). */
export function tokenValido(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token)
}
