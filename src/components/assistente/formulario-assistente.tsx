'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { CampoFormulario, FormularioContexto } from '@/lib/ia/protocolo'

// Registro dos formulários abertos na tela, para o assistente de IA saber o
// que pode preencher. Cada formulário chama useFormularioAssistente(); o
// último registrado é o "formulário atual".

export interface DefinicaoFormulario {
  /** Identificador estável, ex. 'cliente-novo'. */
  id: string
  titulo: string
  descricao?: string
  campos: CampoFormulario[]
  /** Valores atuais (lido na hora de mandar a fala). */
  valores: () => Record<string, unknown>
  /** Aplica os valores que a IA mandou (objeto parcial). */
  preencher: (valores: Record<string, unknown>) => void
  /** Submete o formulário. Sem isto, a IA só preenche. */
  salvar?: () => void
}

interface ContextoRegistro {
  registrar: (ref: { current: DefinicaoFormulario }) => () => void
  atual: () => DefinicaoFormulario | null
}

const Contexto = createContext<ContextoRegistro | null>(null)

export function RegistroFormulariosProvider({ children }: { children: React.ReactNode }) {
  const pilha = useRef<{ current: DefinicaoFormulario }[]>([])

  const registrar = useCallback((ref: { current: DefinicaoFormulario }) => {
    pilha.current.push(ref)
    return () => {
      pilha.current = pilha.current.filter((r) => r !== ref)
    }
  }, [])

  const atual = useCallback(() => pilha.current.at(-1)?.current ?? null, [])

  const valor = useMemo(() => ({ registrar, atual }), [registrar, atual])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useRegistroFormularios() {
  return useContext(Contexto)
}

/** Deixa o formulário disponível para o assistente enquanto estiver na tela. */
export function useFormularioAssistente(definicao: DefinicaoFormulario) {
  const registro = useContext(Contexto)
  const ref = useRef(definicao)
  useEffect(() => {
    ref.current = definicao
  })
  useEffect(() => {
    if (!registro) return
    return registro.registrar(ref)
  }, [registro])
}

export function contextoDoFormulario(def: DefinicaoFormulario | null): FormularioContexto | null {
  if (!def) return null
  return {
    id: def.id,
    titulo: def.titulo,
    descricao: def.descricao,
    campos: def.campos,
    valores: def.valores(),
    podeSalvar: !!def.salvar,
  }
}
