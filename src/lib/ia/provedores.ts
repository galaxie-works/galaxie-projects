// Provedores de IA aceitos no assistente. Arquivo sem segredos: pode ser
// importado no navegador (tela de ajustes) e no servidor.

export type ProvedorIA = 'anthropic' | 'openai' | 'deepseek'

export interface InfoProvedor {
  id: ProvedorIA
  nome: string
  /** Onde a empresa cria a chave. */
  linkChave: string
  prefixoChave?: string
  modelos: { id: string; nome: string; descricao: string }[]
  modeloPadrao: string
}

export const PROVEDORES: Record<ProvedorIA, InfoProvedor> = {
  anthropic: {
    id: 'anthropic',
    nome: 'Anthropic (Claude)',
    linkChave: 'https://platform.claude.com/settings/keys',
    prefixoChave: 'sk-ant-',
    modelos: [
      { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', descricao: 'O mais capaz. Recomendado.' },
      { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', descricao: 'Rápido e bem capaz, custa metade.' },
      { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', descricao: 'O mais rápido e barato.' },
    ],
    modeloPadrao: 'claude-opus-5-5',
  },
  openai: {
    id: 'openai',
    nome: 'OpenAI',
    linkChave: 'https://platform.openai.com/api-keys',
    prefixoChave: 'sk-',
    modelos: [
      { id: 'gpt-5', nome: 'GPT-5', descricao: 'Modelo principal da OpenAI.' },
      { id: 'gpt-5-mini', nome: 'GPT-5 mini', descricao: 'Mais rápido e barato.' },
    ],
    modeloPadrao: 'gpt-5',
  },
  deepseek: {
    id: 'deepseek',
    nome: 'DeepSeek',
    linkChave: 'https://platform.deepseek.com/api_keys',
    prefixoChave: 'sk-',
    modelos: [
      { id: 'deepseek-chat', nome: 'DeepSeek Chat', descricao: 'Rápido, bom para preencher formulários.' },
      { id: 'deepseek-reasoner', nome: 'DeepSeek Reasoner', descricao: 'Pensa mais antes de responder, mais lento.' },
    ],
    modeloPadrao: 'deepseek-chat',
  },
}

export const LISTA_PROVEDORES = Object.values(PROVEDORES)

export function ehProvedor(valor: unknown): valor is ProvedorIA {
  return valor === 'anthropic' || valor === 'openai' || valor === 'deepseek'
}

/** Estado da configuração que pode ir para o navegador (sem a chave). */
export interface ConfigIAPublica {
  provedor: ProvedorIA
  modelo: string
  chaveFinal: string
  ativo: boolean
  atualizadoEm: string
}
