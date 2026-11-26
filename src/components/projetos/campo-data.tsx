'use client'

import { useState } from 'react'
import { CalendarIcon, XIcon } from 'lucide-react'
import { ptBR } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatarData } from '@/lib/formato'

// 'YYYY-MM-DD' <-> Date local, sem deslocamento de fuso.
function paraDate(valor: string): Date | undefined {
  if (!valor) return undefined
  const [a, m, d] = valor.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

function paraTexto(data: Date): string {
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${m}-${d}`
}

type Props = {
  id?: string
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  invalido?: boolean
}

// Seletor de data (Popover + Calendar) que guarda a data como 'YYYY-MM-DD'.
export function CampoData({ id, valor, onChange, placeholder = 'Escolher data', invalido }: Props) {
  const [aberto, setAberto] = useState(false)
  const selecionada = paraDate(valor)

  return (
    <div className="flex items-center gap-1">
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-invalid={invalido || undefined}
              className="flex-1 justify-start font-normal data-[vazio=true]:text-muted-foreground"
              data-vazio={!valor}
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          <span className="truncate tabular-nums">{valor ? formatarData(valor) : placeholder}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selecionada}
            defaultMonth={selecionada}
            onSelect={(data) => {
              onChange(data ? paraTexto(data) : '')
              setAberto(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {valor && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Limpar data"
          onClick={() => onChange('')}
        >
          <XIcon />
        </Button>
      )}
    </div>
  )
}
