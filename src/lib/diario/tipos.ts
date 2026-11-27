// Diário de obra (RDO): tipos compartilhados entre a tela, o armazenamento
// local (IndexedDB) e a sincronização com o Supabase.

export type Clima = 'sol' | 'nublado' | 'chuva' | 'impraticavel'

export const CLIMA_LABEL: Record<Clima, string> = {
  sol: 'Sol',
  nublado: 'Nublado',
  chuva: 'Chuva',
  impraticavel: 'Impraticável',
}

export const CLIMAS = Object.keys(CLIMA_LABEL) as Clima[]

/** Linha da tabela diario_obra. */
export type RegistroDiario = {
  id: string
  empresa_id: string
  projeto_id: string
  data: string
  clima_manha: Clima | null
  clima_tarde: Clima | null
  equipe_presente: string[]
  atividades: string | null
  ocorrencias: string | null
  registrado_em: string
}

/** Foto já enviada (linha de arquivos com diario_id). */
export type FotoEnviada = {
  id: string
  diario_id: string
  caminho: string
  tamanho: number
  url?: string
}

/** Registro guardado no aparelho, esperando envio. */
export type RegistroLocal = RegistroDiario & {
  /** Mensagem do último erro de envio, se houve. */
  erro?: string | null
}

/** Foto guardada no aparelho (já em webp), esperando envio. */
export type FotoLocal = {
  id: string
  registro_id: string
  empresa_id: string
  projeto_id: string
  data: string
  blob: Blob
  largura: number
  altura: number
  criada_em: string
}

/** O que a tela precisa para funcionar sem internet. */
export type ContextoDiario = {
  empresaId: string
  obras: { id: string; nome: string; cliente: string | null }[]
  equipe: { id: string; nome: string; funcao: string | null }[]
  salvoEm: string
}

/** Registro pronto para mostrar: do servidor e/ou ainda no aparelho. */
export type RegistroTela = RegistroDiario & {
  pendente: boolean
  erro?: string | null
  fotos: { id: string; url: string; pendente: boolean; caminho?: string }[]
}

export const BUCKET_ARQUIVOS = 'arquivos'

export function caminhoFoto(f: { empresa_id: string; projeto_id: string; id: string }): string {
  return `${f.empresa_id}/projetos/${f.projeto_id}/diario/${f.id}.webp`
}
