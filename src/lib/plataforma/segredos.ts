import { clienteAdmin } from '@/lib/supabase/admin'
import { chaveMestraConfigurada, cifrar, decifrar } from '@/lib/ia/cripto'

// Chaves do servidor que o admin master troca pelo painel. Ficam cifradas em
// plataforma_segredos (AES-256-GCM com IA_CHAVE_MESTRA) e só o servidor lê,
// com service role. Valem na ordem: painel, depois a variável da Vercel.
// A chave aberta nunca sai daqui para a tela: o painel só vê os 4 finais.

export const SEGREDOS = {
  STRIPE_SECRET_KEY: {
    rotulo: 'Stripe: chave secreta',
    ajuda: 'Começa com sk_live_ (produção) ou sk_test_ (teste). Também aceita chave restrita rk_.',
    prefixos: ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_'],
  },
  STRIPE_WEBHOOK_SECRET: {
    rotulo: 'Stripe: segredo do webhook',
    ajuda: 'Começa com whsec_. O botão "Criar webhook no Stripe" gera e guarda sozinho.',
    prefixos: ['whsec_'],
  },
  ANTHROPIC_API_KEY: {
    rotulo: 'Anthropic: chave da IA da Galaxie',
    ajuda: 'Começa com sk-ant-. É a IA que as empresas sem chave própria usam, gastando a cota do plano.',
    prefixos: ['sk-ant-'],
  },
} as const

export type NomeSegredo = keyof typeof SEGREDOS
export const NOMES_SEGREDOS = Object.keys(SEGREDOS) as NomeSegredo[]

export function ehNomeSegredo(v: unknown): v is NomeSegredo {
  return typeof v === 'string' && v in SEGREDOS
}

export interface SituacaoSegredo {
  nome: NomeSegredo
  rotulo: string
  ajuda: string
  /** De onde vem o valor que está valendo agora. */
  origem: 'painel' | 'vercel' | null
  /** Últimos 4 caracteres do valor que vale. */
  final: string | null
  /** Também existe na Vercel (fica de reserva se a do painel for removida). */
  naVercel: boolean
  atualizadoEm: string | null
}

const TTL = 30_000
let cache: { em: number; valores: Map<NomeSegredo, { valor: string; final: string; em: string }> } | null = null

async function doBanco() {
  if (cache && Date.now() - cache.em < TTL) return cache.valores
  const valores = new Map<NomeSegredo, { valor: string; final: string; em: string }>()
  const db = clienteAdmin()
  if (db && chaveMestraConfigurada()) {
    const { data, error } = await db.from('plataforma_segredos').select('nome, valor_cifrado, final, updated_at')
    // Tabela ainda não existe: segue só com a Vercel.
    if (!error) {
      for (const l of data ?? []) {
        if (!ehNomeSegredo(l.nome)) continue
        try {
          valores.set(l.nome, { valor: decifrar(l.valor_cifrado), final: l.final, em: l.updated_at })
        } catch (e) {
          console.error('segredo não abriu', l.nome, e instanceof Error ? e.message : e)
        }
      }
    }
  }
  cache = { em: Date.now(), valores }
  return valores
}

export function esquecerSegredos() {
  cache = null
}

/** Valor que vale agora (painel, senão Vercel), ou null. Só no servidor. */
export async function lerSegredo(nome: NomeSegredo): Promise<string | null> {
  try {
    const v = (await doBanco()).get(nome)
    if (v) return v.valor
  } catch (e) {
    console.error('lerSegredo', nome, e)
  }
  return process.env[nome] || null
}

export async function situacaoSegredos(): Promise<SituacaoSegredo[]> {
  const banco = await doBanco().catch(() => new Map())
  return NOMES_SEGREDOS.map((nome) => {
    const b = banco.get(nome)
    const env = process.env[nome]
    return {
      nome,
      rotulo: SEGREDOS[nome].rotulo,
      ajuda: SEGREDOS[nome].ajuda,
      origem: b ? 'painel' : env ? 'vercel' : null,
      final: b ? b.final : env ? env.slice(-4) : null,
      naVercel: !!env,
      atualizadoEm: b?.em ?? null,
    }
  })
}

export function validarFormato(nome: NomeSegredo, valor: string): string | null {
  if (!valor || valor.length < 12 || valor.length > 400 || /\s/.test(valor)) {
    return 'Cole a chave inteira, sem espaços.'
  }
  const { prefixos, rotulo } = SEGREDOS[nome]
  if (!prefixos.some((p) => valor.startsWith(p))) {
    return `${rotulo} deve começar com ${prefixos.join(' ou ')}.`
  }
  return null
}

/** Grava cifrada. Quem chama já conferiu que é admin master. */
export async function gravarSegredo(nome: NomeSegredo, valor: string, userId: string) {
  const db = clienteAdmin()
  if (!db) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY no servidor.')
  const { error } = await db.from('plataforma_segredos').upsert({
    nome,
    valor_cifrado: cifrar(valor),
    final: valor.slice(-4),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })
  if (error) throw new Error(error.message)
  esquecerSegredos()
}

export async function apagarSegredo(nome: NomeSegredo) {
  const db = clienteAdmin()
  if (!db) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY no servidor.')
  const { error } = await db.from('plataforma_segredos').delete().eq('nome', nome)
  if (error) throw new Error(error.message)
  esquecerSegredos()
}
