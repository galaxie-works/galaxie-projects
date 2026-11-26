'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Ditado por voz (Web Speech API, pt-BR). Funciona em Chrome/Edge/Android;
// onde não há suporte, `suportado` é false e a UI esconde o microfone.

interface SpeechRecognitionResultLike {
  isFinal: boolean
  [index: number]: { transcript: string }
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { [index: number]: SpeechRecognitionResultLike; length: number }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function obterConstrutor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface OpcoesDitado {
  /** Chamado a cada atualização com o texto ditado até agora nesta sessão. */
  onParcial?: (texto: string) => void
  /** Chamado quando a fala termina, com o texto final da sessão. */
  onFinal?: (texto: string) => void
  /** true: continua ouvindo até `parar()`. Padrão: false (para na pausa). */
  continuo?: boolean
}

export function useDitado({ onParcial, onFinal, continuo = false }: OpcoesDitado = {}) {
  const [suportado, setSuportado] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const reconhecimento = useRef<SpeechRecognitionLike | null>(null)
  const texto = useRef('')
  const callbacks = useRef({ onParcial, onFinal })
  callbacks.current = { onParcial, onFinal }

  useEffect(() => {
    const Ctor = obterConstrutor()
    if (!Ctor) return
    setSuportado(true)
    const r = new Ctor()
    r.lang = 'pt-BR'
    r.continuous = continuo
    r.interimResults = true
    r.onresult = (event) => {
      let t = ''
      for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript
      texto.current = t.trim()
      callbacks.current.onParcial?.(texto.current)
    }
    r.onend = () => {
      setOuvindo(false)
      if (texto.current) callbacks.current.onFinal?.(texto.current)
    }
    r.onerror = () => setOuvindo(false)
    reconhecimento.current = r
    return () => r.stop()
  }, [continuo])

  const iniciar = useCallback(() => {
    if (!reconhecimento.current) return
    texto.current = ''
    try {
      reconhecimento.current.start()
      setOuvindo(true)
    } catch {
      // start() lança se já estiver ouvindo
    }
  }, [])

  const parar = useCallback(() => {
    reconhecimento.current?.stop()
  }, [])

  const alternar = useCallback(() => {
    if (ouvindo) parar()
    else iniciar()
  }, [ouvindo, iniciar, parar])

  return { suportado, ouvindo, iniciar, parar, alternar }
}
