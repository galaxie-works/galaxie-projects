'use client'

import { useRef } from 'react'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

// Campo de texto com microfone: o que for ditado é acrescentado ao texto
// que já estava no campo quando o usuário começou a falar.
export function CampoComVoz({
  id,
  value,
  onChange,
  placeholder,
  invalido,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  invalido?: boolean
  autoFocus?: boolean
}) {
  const base = useRef<string | null>(null)
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalido || undefined}
        autoFocus={autoFocus}
      />
      <InputGroupAddon align="inline-end">
        <BotaoVoz
          size="icon-xs"
          onParcial={(texto) => {
            if (base.current === null) base.current = value.trim()
            onChange(base.current ? `${base.current} ${texto}` : texto)
          }}
          onFinal={() => {
            base.current = null
          }}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}
