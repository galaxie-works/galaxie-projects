'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL, type FormaPagamento } from '@/types'

const SEM_FORMA = 'nenhuma'

const ITENS = [
  { value: SEM_FORMA, label: 'Não informada' },
  ...FORMAS_PAGAMENTO.map((f) => ({ value: f, label: FORMA_PAGAMENTO_LABEL[f] })),
]

type Props = {
  id?: string
  valor: FormaPagamento | null
  onChange: (valor: FormaPagamento | null) => void
}

export function FormaSelect({ id, valor, onChange }: Props) {
  return (
    <Select
      items={ITENS}
      value={valor ?? SEM_FORMA}
      onValueChange={(v) => onChange(!v || v === SEM_FORMA ? null : (v as FormaPagamento))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITENS.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
