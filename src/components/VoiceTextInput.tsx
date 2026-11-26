'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  autoFocus?: boolean
  onSubmit?: () => void
  className?: string
}

interface SpeechRecognitionResultLike {
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

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Campo de texto com suporte a ditado por voz (Web Speech API, pt-BR).
// Funciona em Chrome/Android; em navegadores sem suporte o botão de
// microfone simplesmente não aparece e o campo funciona normalmente.
export default function VoiceTextInput({
  value,
  onChange,
  placeholder,
  multiline,
  autoFocus,
  onSubmit,
  className,
}: Props) {
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => getSpeechRecognitionConstructor() !== null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseValueRef = useRef('')

  useEffect(() => {
    const Ctor = getSpeechRecognitionConstructor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      const joiner =
        baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : ''
      onChange(baseValueRef.current + joiner + transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleListening() {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      baseValueRef.current = value
      recognitionRef.current.start()
      setListening(true)
    }
  }

  const sharedClasses =
    'w-full rounded-xl border border-border bg-card px-4 py-2.5 pr-11 text-[15px] outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent'

  return (
    <div className={`relative ${className ?? ''}`}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={3}
          className={sharedClasses}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) onSubmit()
          }}
          className={sharedClasses}
        />
      )}
      {supported && (
        <button
          type="button"
          onClick={toggleListening}
          title={listening ? 'Parar ditado' : 'Falar em vez de digitar'}
          className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            listening
              ? 'bg-accent text-accent-foreground animate-pulse'
              : 'bg-border/60 text-muted hover:bg-border'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
            <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
          </svg>
        </button>
      )}
    </div>
  )
}
