'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Etapa, Projeto } from '@/types'
import { Badge } from '@/components/reui/badge'
import { Frame, FramePanel } from '@/components/reui/frame'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'

type Props = {
  projeto: Projeto
  etapas: Etapa[]
  totalGasto: number
  /** 'YYYY-MM-DD' calculado no servidor, para não divergir na hidratação. */
  hoje: string
}

function diasEntre(de: string, ate: string): number {
  const a = new Date(`${de.slice(0, 10)}T00:00:00`)
  const b = new Date(`${ate.slice(0, 10)}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function ProjetoVisaoGeral({ projeto, etapas, totalGasto, hoje }: Props) {
  const router = useRouter()
  const [percentual, setPercentual] = useState(projeto.percentual_conclusao)

  async function confirmarPercentual(valor: number) {
    const { error } = await createClient()
      .from('projetos')
      .update({ percentual_conclusao: valor })
      .eq('id', projeto.id)
    if (error) {
      toast.error('Não foi possível salvar o progresso', { description: error.message })
      setPercentual(projeto.percentual_conclusao)
      return
    }
    router.refresh()
  }

  const concluidas = etapas.filter((e) => e.status === 'concluida').length
  const emAndamento = etapas.filter((e) => e.status === 'em_andamento').length

  const orcamento = Number(projeto.orcamento_total ?? 0)
  const consumo = orcamento > 0 ? (totalGasto / orcamento) * 100 : 0
  const saldo = orcamento - totalGasto

  const completo = projeto.status === 'completo'
  const restam = projeto.data_prazo ? diasEntre(hoje, projeto.data_prazo) : null
  const duracao =
    projeto.data_inicio && projeto.data_prazo
      ? diasEntre(projeto.data_inicio, projeto.data_prazo)
      : null
  const decorrido =
    projeto.data_inicio && duracao && duracao > 0
      ? Math.min(100, Math.max(0, (diasEntre(projeto.data_inicio, hoje) / duracao) * 100))
      : null

  return (
    <Frame spacing="default" className="grid grid-cols-1 lg:grid-cols-3">
      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Progresso da obra</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{percentual}%</span>
        </div>
        <Slider
          value={[percentual]}
          min={0}
          max={100}
          step={5}
          aria-label="Percentual de conclusão"
          onValueChange={(v) => setPercentual(Array.isArray(v) ? v[0] : v)}
          onValueCommitted={(v) => confirmarPercentual(Array.isArray(v) ? v[0] : v)}
        />
        <Separator />
        <Linha rotulo="Etapas concluídas" valor={`${concluidas} de ${etapas.length}`} />
        <Linha rotulo="Em andamento" valor={String(emAndamento)} />
      </FramePanel>

      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Gasto até agora</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatarMoeda(totalGasto)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress
            value={Math.min(100, consumo)}
            className="flex-1"
            aria-label="Gasto em relação ao orçamento"
          />
          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(consumo)}%</span>
        </div>
        <Separator />
        <Linha rotulo="Orçamento" valor={formatarMoeda(orcamento)} />
        <Linha
          rotulo={saldo >= 0 ? 'Saldo disponível' : 'Acima do orçamento'}
          valor={formatarMoeda(Math.abs(saldo))}
          alerta={saldo < 0}
        />
      </FramePanel>

      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Prazo</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {completo
              ? 'Concluída'
              : restam === null
                ? 'Sem prazo'
                : restam >= 0
                  ? `${restam} ${restam === 1 ? 'dia' : 'dias'}`
                  : `${-restam} ${restam === -1 ? 'dia' : 'dias'} de atraso`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress
            value={completo ? 100 : (decorrido ?? 0)}
            className="flex-1"
            aria-label="Tempo decorrido do prazo"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {decorrido === null ? '—' : `${Math.round(completo ? 100 : decorrido)}%`}
          </span>
        </div>
        <Separator />
        <Linha rotulo="Início" valor={formatarData(projeto.data_inicio)} />
        <Linha
          rotulo="Prazo final"
          valor={formatarData(projeto.data_prazo)}
          alerta={!completo && restam !== null && restam < 0}
        />
      </FramePanel>
    </Frame>
  )
}

function Linha({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="flex items-center gap-2">
        {alerta && <Badge variant="destructive-light">Vencido</Badge>}
        <span className="font-medium tabular-nums">{valor}</span>
      </span>
    </div>
  )
}
