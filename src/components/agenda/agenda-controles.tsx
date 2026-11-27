'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { CampoData } from '@/components/projetos/campo-data'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { somarDias } from '@/lib/agenda'
import type { MembroEquipe } from '@/types'

export type ModoAgenda = 'dia' | 'semana'
export const TODOS = 'todos'
export const SEM_RESPONSAVEL_FILTRO = 'ninguem'

type Props = {
  dia: string
  modo: ModoAgenda
  responsavel: string
  hoje: string
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
}

// Barra da Agenda: dia ou semana, navegar no tempo e filtrar por responsável.
// O estado fica na URL, então voltar e recarregar mantêm a mesma visão.
export function AgendaControles({ dia, modo, responsavel, hoje, equipe }: Props) {
  const router = useRouter()

  function ir(parcial: Partial<{ dia: string; modo: ModoAgenda; responsavel: string }>) {
    const p = { dia, modo, responsavel, ...parcial }
    const busca = new URLSearchParams()
    if (p.dia !== hoje) busca.set('dia', p.dia)
    if (p.modo !== 'dia') busca.set('modo', p.modo)
    if (p.responsavel !== TODOS) busca.set('resp', p.responsavel)
    const q = busca.toString()
    router.push(q ? `/agenda?${q}` : '/agenda')
  }

  const passo = modo === 'dia' ? 1 : 7
  const itensResponsavel = [
    { value: TODOS, label: 'Toda a equipe' },
    { value: SEM_RESPONSAVEL_FILTRO, label: 'Sem responsável' },
    ...equipe.map((m) => ({ value: m.id, label: m.nome })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        variant="outline"
        size="sm"
        value={[modo]}
        onValueChange={(v) => {
          const novo = v[0] as ModoAgenda | undefined
          if (novo) ir({ modo: novo })
        }}
        aria-label="Visão da agenda"
      >
        <ToggleGroupItem value="dia">Dia</ToggleGroupItem>
        <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
      </ToggleGroup>

      <ButtonGroup>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={modo === 'dia' ? 'Dia anterior' : 'Semana anterior'}
          onClick={() => ir({ dia: somarDias(dia, -passo) })}
        >
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="sm" onClick={() => ir({ dia: hoje })} disabled={dia === hoje}>
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={modo === 'dia' ? 'Próximo dia' : 'Próxima semana'}
          onClick={() => ir({ dia: somarDias(dia, passo) })}
        >
          <ChevronRightIcon />
        </Button>
      </ButtonGroup>

      <CampoData valor={dia} onChange={(d) => ir({ dia: d || hoje })} placeholder="Ir para data" />

      <Select
        items={itensResponsavel}
        value={responsavel}
        onValueChange={(v) => ir({ responsavel: (v as string | null) ?? TODOS })}
      >
        <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por responsável">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {itensResponsavel.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
