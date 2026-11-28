'use client'

import { useRouter } from 'next/navigation'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type VistaInicio = 'hoje' | 'semana'

// Hoje ou os próximos 7 dias. Fica na URL para voltar e recarregar na mesma visão.
export function VistaInicioToggle({ vista }: { vista: VistaInicio }) {
  const router = useRouter()
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[vista]}
      onValueChange={(v) => {
        const nova = v[0] as VistaInicio | undefined
        if (nova) router.push(nova === 'hoje' ? '/inicio' : '/inicio?vista=semana')
      }}
      aria-label="Período do painel"
    >
      <ToggleGroupItem value="hoje">Hoje</ToggleGroupItem>
      <ToggleGroupItem value="semana">Próximos 7 dias</ToggleGroupItem>
    </ToggleGroup>
  )
}
