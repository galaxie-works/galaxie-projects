// Quem entra no app e o que pode fazer. O dono da empresa pode tudo; quem
// foi convidado entra com um papel e permissões por módulo. O banco aplica
// as mesmas regras (funções nivel_acesso / tem_acesso nas políticas), então
// esconder aqui é só para não mostrar o que daria erro.

export const MODULOS = [
  { id: 'clientes', rotulo: 'Clientes', descricao: 'Contatos, pós-venda e portal' },
  { id: 'negocios', rotulo: 'Negócios', descricao: 'Funil e propostas' },
  { id: 'obras', rotulo: 'Obras', descricao: 'Etapas e orçamentos' },
  { id: 'agenda', rotulo: 'Agenda', descricao: 'Tarefas e retornos' },
  { id: 'diario', rotulo: 'Diário de obra', descricao: 'Registros e fotos' },
  { id: 'financeiro', rotulo: 'Financeiro', descricao: 'Recebimentos, compras, margem e notas' },
  { id: 'equipe', rotulo: 'Equipe', descricao: 'Cadastro da equipe' },
  { id: 'empresa', rotulo: 'Empresa', descricao: 'Dados, serviços, preços e assistente' },
] as const

export type Modulo = (typeof MODULOS)[number]['id']
export type Nivel = 'nenhum' | 'ver' | 'editar'
export type Papel = 'dono' | 'gestor' | 'membro'
export type Permissoes = Partial<Record<Modulo, Nivel>>

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: 'Dono',
  gestor: 'Gestor',
  membro: 'Membro',
}

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  dono: 'Acesso total',
  gestor: 'Tudo, exceto assinatura e acessos',
  membro: 'Só os módulos que você liberar',
}

export const ROTULO_NIVEL: Record<Nivel, string> = { nenhum: 'Não vê', ver: 'Vê', editar: 'Edita' }

/** Módulos que só ficam de fora para o membro "de campo". */
const MODULOS_CAMPO: Modulo[] = ['diario', 'agenda']

/** Pacotes prontos de permissões para começar o convite. */
export const MODELOS_PERMISSAO: { id: string; rotulo: string; permissoes: Permissoes }[] = [
  {
    id: 'campo',
    rotulo: 'Equipe de campo',
    permissoes: { diario: 'editar', agenda: 'ver', obras: 'ver' },
  },
  {
    id: 'vendas',
    rotulo: 'Vendas',
    permissoes: { clientes: 'editar', negocios: 'editar', agenda: 'editar', obras: 'ver' },
  },
  {
    id: 'escritorio',
    rotulo: 'Escritório',
    permissoes: {
      clientes: 'editar',
      negocios: 'editar',
      obras: 'editar',
      agenda: 'editar',
      diario: 'editar',
      equipe: 'ver',
      empresa: 'ver',
    },
  },
]

const NUMERO: Record<Nivel, number> = { nenhum: 0, ver: 1, editar: 2 }

export type Acesso = {
  papel: Papel
  permissoes: Permissoes
  /** Pode ver (ou editar) o módulo. */
  pode: (modulo: Modulo | 'assinatura' | 'acessos', nivel?: 'ver' | 'editar') => boolean
}

export function montarAcesso(papel: Papel, permissoes: Permissoes): Acesso {
  return {
    papel,
    permissoes,
    pode(modulo, nivel = 'ver') {
      if (papel === 'dono') return true
      if (modulo === 'assinatura' || modulo === 'acessos') return false
      if (papel === 'gestor') return true
      return NUMERO[permissoes[modulo] ?? 'nenhum'] >= NUMERO[nivel]
    },
  }
}

/** Login de campo: só diário/agenda (e ver obras). Conta no limite de campo do plano. */
export function ehLoginDeCampo(papel: Papel, permissoes: Permissoes): boolean {
  if (papel !== 'membro') return false
  return MODULOS.every(({ id }) => {
    const n = permissoes[id] ?? 'nenhum'
    if (n === 'nenhum') return true
    if (MODULOS_CAMPO.includes(id)) return true
    return id === 'obras' && n === 'ver'
  })
}
