// Planos do Galaxie Obras (aprovados pelo Wagner em 27/11/2026).
// Estes são os valores de partida: o que vale é o que o admin master salva no
// painel (/admin, tabelas plataforma_planos e plataforma_config), lido em
// src/lib/plataforma/config.ts. No Stripe, cada preço é achado pela
// lookup_key abaixo; o painel cria e atualiza os preços com essas chaves.

export type PlanoId = 'autonomo' | 'equipe' | 'empresa'
export type Ciclo = 'mensal' | 'anual'

export interface Plano {
  id: PlanoId
  nome: string
  resumo: string
  /** Em reais. */
  mensal: number
  anual: number
  escritorio: string
  campo: string
  obras: string
  /** Comandos de IA por mês. */
  comandosIA: number
  /** Logins de escritório inclusos (com o dono). null = ilimitado. */
  usuariosEscritorio?: number | null
  /** Logins de campo inclusos (só diário e agenda). null = ilimitado. */
  usuariosCampo?: number | null
  destaque?: boolean
}

export const PLANOS: Plano[] = [
  {
    id: 'autonomo',
    nome: 'Autônomo',
    resumo: 'Para quem toca as obras sozinho.',
    mensal: 89,
    anual: 890,
    escritorio: '1 usuário no escritório',
    campo: 'Até 2 na equipe de campo',
    obras: 'Até 5 obras ativas',
    comandosIA: 150,
    usuariosEscritorio: 1,
    usuariosCampo: 2,
  },
  {
    id: 'equipe',
    nome: 'Equipe',
    resumo: 'Para a empresa com escritório e turmas em campo.',
    mensal: 199,
    anual: 1990,
    escritorio: 'Até 5 no escritório',
    campo: 'Equipe de campo ilimitada',
    obras: 'Até 20 obras ativas',
    comandosIA: 600,
    usuariosEscritorio: 5,
    usuariosCampo: null,
    destaque: true,
  },
  {
    id: 'empresa',
    nome: 'Empresa',
    resumo: 'Para construtoras com várias frentes.',
    mensal: 399,
    anual: 3990,
    escritorio: 'Até 15 no escritório',
    campo: 'Equipe de campo ilimitada',
    obras: 'Obras ativas ilimitadas',
    comandosIA: 2000,
    usuariosEscritorio: 15,
    usuariosCampo: null,
  },
]

/** Comandos que o teste grátis inclui (igual ao padrão de ia_carteira). */
export const COMANDOS_TESTE = 150
/** Cortesia (contas da casa) usa a cota do maior plano. */
export const COMANDOS_CORTESIA = 2000

export const PACOTE_IA = { comandos: 500, preco: 29, lookupKey: 'obras_ia_500' } as const
export const USUARIO_EXTRA = { preco: 29, lookupKey: 'obras_usuario_extra' } as const

export function lookupKey(plano: PlanoId, ciclo: Ciclo) {
  return `obras_${plano}_${ciclo}`
}

/** Lê "obras_equipe_anual" de volta para plano e ciclo. */
export function lerLookupKey(chave: string | null | undefined): { plano: PlanoId; ciclo: Ciclo } | null {
  const m = /^obras_(autonomo|equipe|empresa)_(mensal|anual)$/.exec(chave ?? '')
  return m ? { plano: m[1] as PlanoId, ciclo: m[2] as Ciclo } : null
}

export const reais = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
