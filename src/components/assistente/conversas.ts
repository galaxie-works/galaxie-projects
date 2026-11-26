'use client'

import { useSyncExternalStore } from 'react'
import type { MensagemHistorico, PerguntaAssistente } from '@/lib/ia/protocolo'

// Conversas do assistente guardadas neste navegador (como a lista de
// "Recentes" do app do Claude). Ficam só no aparelho: nada vai ao banco.

export interface Mensagem extends MensagemHistorico {
  passos?: string[]
  erro?: boolean
  /** A resposta mexeu na tela (preencheu ou salvou): mostra "Ver na tela". */
  mexeuNaTela?: boolean
  /** Pergunta com opções clicáveis feita nesta resposta. */
  pergunta?: PerguntaAssistente
  /** Índice da opção que o usuário tocou. */
  escolhida?: number
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
}

/** Marca a opção escolhida numa pergunta, sem mudar a ordem da lista. */
export function marcarEscolha(id: string, mensagem: number, opcao: number) {
  gravar(
    ler().map((c) =>
      c.id !== id
        ? c
        : { ...c, mensagens: c.mensagens.map((m, i) => (i === mensagem ? { ...m, escolhida: opcao } : m)) },
    ),
  )
}

/** Texto da mensagem para o histórico enviado à IA (inclui a pergunta feita). */
export function textoParaHistorico(m: Mensagem): string {
  if (!m.pergunta) return m.texto
  const opcoes = m.pergunta.opcoes.map((o) => o.rotulo).join('; ')
  return `${m.texto}\n\n[Perguntei: ${m.pergunta.pergunta} Opções: ${opcoes}]`.trim()
}

export function apagarConversa(id: string) {
  gravar(ler().filter((c) => c.id !== id))
}

export function novoId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c${Date.now()}${Math.random().toString(36).slice(2)}`
}
