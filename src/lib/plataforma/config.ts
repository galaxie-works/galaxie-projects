import { createClient as criar, type SupabaseClient } from '@supabase/supabase-js'
import {
  COMANDOS_CORTESIA,
  COMANDOS_TESTE,
  PACOTE_IA,
  PLANOS,
  USUARIO_EXTRA,
  type Plano,
  type PlanoId,
} from '@/lib/planos'

// Planos, preços e valores soltos que o admin master edita no painel
// (tabelas plataforma_planos e plataforma_config). Não são segredo: qualquer
// um lê. Se o banco ainda não tiver as tabelas, valem os valores de planos.ts.
// Só roda no servidor; a tela recebe o resultado por props.

export interface ConfigPlataforma {
  comandosTeste: number
  comandosCortesia: number
  pacoteIA: { comandos: number; preco: number; lookupKey: string }
  usuarioExtra: { preco: number; lookupKey: string }
}

export const CONFIG_PADRAO: ConfigPlataforma = {
  comandosTeste: COMANDOS_TESTE,
  comandosCortesia: COMANDOS_CORTESIA,
  pacoteIA: { ...PACOTE_IA },
  usuarioExtra: { ...USUARIO_EXTRA },
}

/** Plano como o painel guarda: com o "ativo" (à venda ou não). */
export type PlanoPainel = Plano & { ativo: boolean }

const TTL = 30_000
let cache: { em: number; planos: PlanoPainel[]; config: ConfigPlataforma } | null = null

function leitor(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !chave) return null
  return criar(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}

interface LinhaPlano {
  id: PlanoId
  nome: string
  resumo: string
  mensal: number | string
  anual: number | string
  escritorio: string
  campo: string
  obras: string
  comandos_ia: number
  destaque: boolean
  ativo: boolean
}

const numero = (v: unknown, padrao: number) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : padrao
}

async function carregar() {
  const db = leitor()
  const padrao = { planos: PLANOS.map((p) => ({ ...p, ativo: true })), config: CONFIG_PADRAO }
  if (!db) return padrao

  const [planos, config] = await Promise.all([
    db.from('plataforma_planos').select('*').order('ordem'),
    db.from('plataforma_config').select('chave, valor'),
  ])

  const lista: PlanoPainel[] =
    !planos.error && planos.data?.length
      ? (planos.data as LinhaPlano[]).map((l) => ({
          id: l.id,
          nome: l.nome,
          resumo: l.resumo,
          mensal: numero(l.mensal, 0),
          anual: numero(l.anual, 0),
          escritorio: l.escritorio,
          campo: l.campo,
          obras: l.obras,
          comandosIA: l.comandos_ia,
          destaque: l.destaque,
          ativo: l.ativo,
        }))
      : padrao.planos

  const v = new Map<string, unknown>(
    !config.error ? (config.data ?? []).map((c: { chave: string; valor: unknown }) => [c.chave, c.valor]) : [],
  )
  const c: ConfigPlataforma = {
    comandosTeste: numero(v.get('comandos_teste'), CONFIG_PADRAO.comandosTeste),
    comandosCortesia: numero(v.get('comandos_cortesia'), CONFIG_PADRAO.comandosCortesia),
    pacoteIA: {
      ...CONFIG_PADRAO.pacoteIA,
      comandos: numero(v.get('pacote_ia_comandos'), CONFIG_PADRAO.pacoteIA.comandos),
      preco: numero(v.get('pacote_ia_preco'), CONFIG_PADRAO.pacoteIA.preco),
    },
    usuarioExtra: {
      ...CONFIG_PADRAO.usuarioExtra,
      preco: numero(v.get('usuario_extra_preco'), CONFIG_PADRAO.usuarioExtra.preco),
    },
  }
  return { planos: lista, config: c }
}

async function atual() {
  if (cache && Date.now() - cache.em < TTL) return cache
  try {
    cache = { em: Date.now(), ...(await carregar()) }
  } catch (e) {
    console.error('plataforma config', e)
    cache ??= { em: 0, planos: PLANOS.map((p) => ({ ...p, ativo: true })), config: CONFIG_PADRAO }
  }
  return cache
}

/** Depois de salvar no painel, a próxima leitura vai ao banco. */
export function esquecerConfig() {
  cache = null
}

/** Todos os planos, inclusive os fora da venda (o webhook precisa deles). */
export async function lerTodosPlanos(): Promise<PlanoPainel[]> {
  return (await atual()).planos
}

/** Planos à venda, na ordem da tela. */
export async function lerPlanos(): Promise<Plano[]> {
  return (await atual()).planos.filter((p) => p.ativo)
}

export async function planoPorId(id: string | null | undefined) {
  return (await atual()).planos.find((p) => p.id === id) ?? null
}

export async function lerConfig(): Promise<ConfigPlataforma> {
  return (await atual()).config
}
