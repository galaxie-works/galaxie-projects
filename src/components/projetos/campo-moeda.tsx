'use client'

import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/reui/number-field'

type Props = {
  id?: string
  valor: number | null
  onChange: (valor: number | null) => void
  invalido?: boolean
  placeholder?: string
}

// Valor em reais (R$) com máscara pt-BR do próprio @reui/number-field.
export function CampoMoeda({ id, valor, onChange, invalido, placeholder = 'R$ 0,00' }: Props) {
  return (
    <NumberField
      id={id}
      value={valor}
      onValueChange={(v) => onChange(v)}
      min={0}
      step={0.01}
      locale="pt-BR"
      format={{ style: 'currency', currency: 'BRL' }}
    >
      <NumberFieldGroup className="w-full">
        <NumberFieldInput
          className="text-left tabular-nums"
          placeholder={placeholder}
          aria-invalid={invalido || undefined}
        />
      </NumberFieldGroup>
    </NumberField>
  )
}
