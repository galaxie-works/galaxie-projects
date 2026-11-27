'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/reui/number-field'
import type { ResultadoAdmin } from '@/app/(dashboard)/admin/actions'

/** Roda uma ação do painel, mostra o resultado num toast e recarrega os dados. */
export function useAcaoAdmin() {
  const router = useRouter()
  const [rodando, iniciar] = useTransition()
  function rodar(acao: () => Promise<ResultadoAdmin>, depois?: (ok: boolean) => void) {
    iniciar(async () => {
      const r = await acao()
      if (r.ok) {
        toast.success(r.mensagem)
        router.refresh()
      } else {
        toast.error(r.erro)
      }
      depois?.(r.ok)
    })
  }
  return { rodando, rodar }
}

type CampoNumeroProps = {
  id?: string
  valor: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  /** Reais (R$ 0,00), porcentagem ou número inteiro. */
  formato?: 'reais' | 'inteiro' | 'porcentagem'
  invalido?: boolean
}

export function CampoNumero({ id, valor, onChange, min = 0, max, formato = 'inteiro', invalido }: CampoNumeroProps) {
  const format: Intl.NumberFormatOptions =
    formato === 'reais'
      ? { style: 'currency', currency: 'BRL' }
      : formato === 'porcentagem'
        ? { maximumFractionDigits: 2 }
        : { maximumFractionDigits: 0 }
  return (
    <NumberField
      id={id}
      value={valor}
      onValueChange={(v) => onChange(v)}
      min={min}
      max={max}
      step={formato === 'inteiro' ? 1 : 0.01}
      locale="pt-BR"
      format={format}
    >
      <NumberFieldGroup className="w-full" aria-invalid={invalido || undefined}>
        <NumberFieldInput className="text-left tabular-nums" aria-invalid={invalido || undefined} />
      </NumberFieldGroup>
    </NumberField>
  )
}

export const dataCurta = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—')
