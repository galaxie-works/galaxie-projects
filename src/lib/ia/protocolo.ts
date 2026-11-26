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

export type TabelaAssistente = 'clientes' | 'projetos' | 'etapas' | 'compras' | 'equipe' | 'recebimentos'

/** O que a tela precisa fazer depois da resposta da IA. */
export type AcaoAssistente =
  | { tipo: 'preencher'; formularioId: string; valores: Record<string, unknown> }
  | { tipo: 'salvar'; formularioId: string }
  | { tipo: 'excluir'; tabela: TabelaAssistente; id: string; descricao: string }
  | { tipo: 'navegar'; caminho: string }
  | { tipo: 'atualizar' }

/** Uma pergunta com opções clicáveis (uma por vez), como no app do Claude. */
export interface OpcaoPergunta {
  rotulo: string
  descricao?: string
  recomendada?: boolean
}

export interface PerguntaAssistente {
  pergunta: string
  opcoes: OpcaoPergunta[]
}

/** Obra resumida para o cartão de progresso (dados calculados no servidor). */
export interface ObraResumo {
  id: string
  nome: string
  cliente: string | null
  status: string
  percentual: number
  prazo: string | null
  atrasada: boolean
  etapas: { concluidas: number; andamento: number; pendentes: number }
  proxima: { nome: string; prazo: string | null; emAndamento: boolean } | null
}

export interface CartaoObras {
  titulo: string
  obras: ObraResumo[]
  /** Quantas obras ficaram de fora do cartão (limite). */
  restantes: number
}

export interface RespostaAssistente {
  resposta: string
  acoes: AcaoAssistente[]
  /** O que a IA fez no caminho, para mostrar como passos ("Buscou clientes"). */
  passos?: string[]
  /** Quando a IA precisa de uma escolha: mostra o cartão e espera. */
  pergunta?: PerguntaAssistente
  /** Cartão de obras com progresso por etapas. */
  obras?: CartaoObras
}

export interface ErroAssistente {
  erro: string
  /** true quando falta configurar a chave em /ajustes. */
  semConfiguracao?: boolean
  /** Ações que já deram certo antes do erro (ex.: registro criado). */
  acoes?: AcaoAssistente[]
  passos?: string[]
}
