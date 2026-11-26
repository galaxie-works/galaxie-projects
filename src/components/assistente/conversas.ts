'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CartaoObras, MensagemHistorico, PerguntaAssistente } from '@/lib/ia/protocolo'

// Conversas do assistente (lista "Recentes", como no app do Claude).
// A tela lê e grava num cache local, na hora; por trás, cada mudança vai para
// a tabela assistente_conversas do Supabase, então as conversas aparecem em
// qualquer aparelho. Sem a tabela (ou sem rede), segue só no aparelho.

export interface Mensagem extends MensagemHistorico {
  passos?: string[]
  erro?: boolean
  /** A resposta mexeu na tela (preencheu ou salvou): mostra "Ver na tela". */
  mexeuNaTela?: boolean
  /** Pergunta com opções clicáveis feita nesta resposta. */
  pergunta?: PerguntaAssistente
  /** Índice da opção que o usuário tocou. */
  escolhida?: number
  /** Cartão de obras com progresso. */
  obras?: CartaoObras
}

export interface Conversa {
  id: string
  titulo: string
  atualizadaEm: number
  mensagens: Mensagem[]
}

const CHAVE = 'galaxie:assistente:conversas'
const MAXIMO = 30
const VAZIO: Conversa[] = []

let cache: Conversa[] | null = null
/** Empresa da sessão; definida quando a sincronia com o Supabase começa. */
let empresaSincronia: string | null = null
const ouvintes = new Set<() => void>()

function ler(): Conversa[] {
  if (cache) return cache
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) ?? '[]')
    cache = Array.isArray(bruto) ? (bruto as Conversa[]) : []
  } catch {
    cache = []
  }
  return cache
}

async function enviarAoBanco(c: Conversa) {
  if (!empresaSincronia) return
  const { error } = await createClient()
    .from('assistente_conversas')
    .upsert({
      id: c.id,
      empresa_id: empresaSincronia,
      titulo: c.titulo,
      mensagens: c.mensagens,
      atualizada_em: new Date(c.atualizadaEm).toISOString(),
    })
  if (error) console.warn('Conversa não sincronizou:', error.message)
}

async function apagarDoBanco(id: string) {
  if (!empresaSincronia) return
  const { error } = await createClient().from('assistente_conversas').delete().eq('id', id)
  if (error) console.warn('Conversa não foi apagada no banco:', error.message)
}

/**
 * Busca as conversas do usuário no Supabase e junta com as do aparelho
 * (as que só existem aqui sobem). Sem a tabela, fica tudo local.
 */
export async function sincronizarConversas(empresaId: string) {
  const { data, error } = await createClient()
    .from('assistente_conversas')
    .select('id, titulo, mensagens, atualizada_em')
    .order('atualizada_em', { ascending: false })
    .limit(MAXIMO)
  if (error) {
    console.warn('Conversas só neste aparelho:', error.message)
    return
  }
  empresaSincronia = empresaId
  const remotas: Conversa[] = (data ?? []).map((r) => ({
    id: r.id as string,
    titulo: (r.titulo as string) || 'Conversa',
    mensagens: Array.isArray(r.mensagens) ? (r.mensagens as Mensagem[]) : [],
    atualizadaEm: new Date(r.atualizada_em as string).getTime(),
  }))
  const porId = new Map(remotas.map((c) => [c.id, c]))
  for (const local of ler()) {
    const remota = porId.get(local.id)
    if (!remota || local.atualizadaEm > remota.atualizadaEm) {
      porId.set(local.id, local)
      void enviarAoBanco(local)
    }
  }
  gravar([...porId.values()].sort((a, b) => b.atualizadaEm - a.atualizadaEm))
}

function gravar(lista: Conversa[]) {
  cache = lista.slice(0, MAXIMO)
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(cache))
  } catch {
    // Sem armazenamento (aba anônima, cota cheia): segue só em memória.
  }
  ouvintes.forEach((f) => f())
}

function assinar(f: () => void) {
  ouvintes.add(f)
  const deOutraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE) return
    cache = null
    f()
  }
  window.addEventListener('storage', deOutraAba)
  return () => {
    ouvintes.delete(f)
    window.removeEventListener('storage', deOutraAba)
  }
}

export function useConversas(): Conversa[] {
  return useSyncExternalStore(assinar, ler, () => VAZIO)
}

export function obterConversa(id: string | null): Conversa | undefined {
  return id ? ler().find((c) => c.id === id) : undefined
}

function tituloDe(texto: string) {
  const t = texto.replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57)}…` : t
}

/** Acrescenta a mensagem (cria a conversa se preciso) e a põe no topo. */
export function adicionarMensagem(id: string, mensagem: Mensagem) {
  const lista = ler()
  const atual = lista.find((c) => c.id === id)
  const conversa: Conversa = atual
    ? { ...atual, atualizadaEm: Date.now(), mensagens: [...atual.mensagens, mensagem] }
    : { id, titulo: tituloDe(mensagem.texto), atualizadaEm: Date.now(), mensagens: [mensagem] }
  gravar([conversa, ...lista.filter((c) => c.id !== id)])
  void enviarAoBanco(conversa)
}

/** Marca a opção escolhida numa pergunta, sem mudar a ordem da lista. */
export function marcarEscolha(id: string, mensagem: number, opcao: number) {
  const lista = ler().map((c) =>
    c.id !== id
      ? c
      : { ...c, mensagens: c.mensagens.map((m, i) => (i === mensagem ? { ...m, escolhida: opcao } : m)) },
  )
  gravar(lista)
  const alterada = lista.find((c) => c.id === id)
  if (alterada) void enviarAoBanco(alterada)
}

/** Texto da mensagem para o histórico enviado à IA (inclui a pergunta feita). */
export function textoParaHistorico(m: Mensagem): string {
  let texto = m.texto
  if (m.obras) {
    const lista = m.obras.obras.map((o) => `${o.nome} (${o.percentual}%)`).join('; ')
    texto += `\n\n[Mostrei o cartão "${m.obras.titulo}": ${lista || 'nenhuma'}]`
  }
  if (m.pergunta) {
    const opcoes = m.pergunta.opcoes.map((o) => o.rotulo).join('; ')
    texto += `\n\n[Perguntei: ${m.pergunta.pergunta} Opções: ${opcoes}]`
  }
  return texto.trim()
}

export function apagarConversa(id: string) {
  gravar(ler().filter((c) => c.id !== id))
  void apagarDoBanco(id)
}

export function novoId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c${Date.now()}${Math.random().toString(36).slice(2)}`
}
