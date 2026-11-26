// Contrato entre a tela (navegador) e a rota /api/assistente.
// Sem segredos: importado nos dois lados.

/** Um campo de formulário que o assistente pode preencher. */
export interface CampoFormulario {
  nome: string
  /** O que o campo significa, em português, para a IA entender. */
  descricao: string
  /** JSON Schema do valor (string, number, enum, array de objetos...). */
  esquema: Record<string, unknown>
}

/** Descrição do formulário aberto na tela, enviada junto com a fala. */
export interface FormularioContexto {
  id: string
  titulo: string
  descricao?: string
  campos: CampoFormulario[]
  valores: Record<string, unknown>
  podeSalvar: boolean
}

export interface MensagemHistorico {
  papel: 'usuario' | 'assistente'
  texto: string
}

export interface PedidoAssistente {
  texto: string
  /** Caminho da página atual, ex. /projetos/123. */
  pagina: string
  formulario?: FormularioContexto | null
  historico?: MensagemHistorico[]
}

export type TabelaAssistente = 'clientes' | 'projetos' | 'etapas' | 'compras' | 'equipe'

/** O que a tela precisa fazer depois da resposta da IA. */
export type AcaoAssistente =
  | { tipo: 'preencher'; formularioId: string; valores: Record<string, unknown> }
  | { tipo: 'salvar'; formularioId: string }
  | { tipo: 'excluir'; tabela: TabelaAssistente; id: string; descricao: string }
  | { tipo: 'navegar'; caminho: string }
  | { tipo: 'atualizar' }

export interface RespostaAssistente {
  resposta: string
  acoes: AcaoAssistente[]
}

export interface ErroAssistente {
  erro: string
  /** true quando falta configurar a chave em /ajustes. */
  semConfiguracao?: boolean
}
