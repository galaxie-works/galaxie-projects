'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProgressBar from '@/components/ProgressBar'
import {
  STATUS_PROJETO_LABEL,
  type Projeto,
  type StatusProjeto,
} from '@/types'

type Props = {
  projeto: Projeto
  totalGasto: number
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ProjetoHeader({ projeto, totalGasto }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<StatusProjeto>(projeto.status)
  const [percentual, setPercentual] = useState(projeto.percentual_conclusao)

  async function atualizarStatus(novoStatus: StatusProjeto) {
    setStatus(novoStatus)
    await supabase
      .from('projetos')
      .update({ status: novoStatus })
      .eq('id', projeto.id)
    router.refresh()
  }

  async function confirmarPercentual() {
    await supabase
      .from('projetos')
      .update({ percentual_conclusao: percentual })
      .eq('id', projeto.id)
    router.refresh()
  }

  const orcamento = projeto.orcamento_total ?? 0
  const percentualGasto =
    orcamento > 0 ? Math.min(100, (totalGasto / orcamento) * 100) : 0
  const prazoVencido =
    projeto.data_prazo &&
    status !== 'completo' &&
    new Date(projeto.data_prazo) < new Date(new Date().toDateString())

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{projeto.clientes?.nome}</p>
          <h1 className="text-xl font-semibold">{projeto.nome}</h1>
        </div>
        <select
          value={status}
          onChange={(e) => atualizarStatus(e.target.value as StatusProjeto)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        >
          {Object.entries(STATUS_PROJETO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Progresso da obra
          </p>
          <div className="mb-2 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={percentual}
              onChange={(e) => setPercentual(Number(e.target.value))}
              onMouseUp={confirmarPercentual}
              onTouchEnd={confirmarPercentual}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm font-medium">
              {percentual}%
            </span>
          </div>
          <ProgressBar percent={percentual} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Orçamento
          </p>
          <p className="text-lg font-semibold">{formatBRL(totalGasto)}</p>
          <p className="mb-2 text-xs text-muted">de {formatBRL(orcamento)}</p>
          <ProgressBar percent={percentualGasto} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Prazos
          </p>
          <p className="text-sm">
            Início:{' '}
            <span className="font-medium">
              {projeto.data_inicio
                ? new Date(projeto.data_inicio).toLocaleDateString('pt-BR')
                : '—'}
            </span>
          </p>
          <p className={`text-sm ${prazoVencido ? 'text-red-600' : ''}`}>
            Prazo final:{' '}
            <span className="font-medium">
              {projeto.data_prazo
                ? new Date(projeto.data_prazo).toLocaleDateString('pt-BR')
                : '—'}
            </span>
            {prazoVencido ? ' (vencido)' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
