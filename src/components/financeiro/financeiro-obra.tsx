'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRangeIcon, PlusIcon, WalletIcon } from 'lucide-react'
import { formatarMoeda } from '@/lib/formato'
import { resumoRecebimentos } from '@/lib/financeiro'
import type { Cliente, Projeto, Recebimento } from '@/types'
import { NotasObra } from '@/components/fiscal/notas-obra'
import { Frame, FrameDescription, FrameHeader, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Numero } from './numero'
import { PlanoPagamentoDialog } from './plano-pagamento-dialog'
import { RecebimentoDialog } from './recebimento-dialog'
import { RecebimentosTabela } from './recebimentos-tabela'

type Props = {
  projeto: Projeto
  recebimentos: Recebimento[]
  onRecebimentosChange: (lista: Recebimento[]) => void
  totalGasto: number
  hoje: string
  /** false antes de rodar o SQL do financeiro. */
  disponivel: boolean
  cliente?: Cliente | null
}

// Aba Financeiro da obra: números, plano de pagamento e parcelas.
export function FinanceiroObra({
  projeto,
  recebimentos,
  onRecebimentosChange,
  totalGasto,
  hoje,
  disponivel,
  cliente = null,
}: Props) {
  const router = useRouter()
  const [plano, setPlano] = useState(false)
  const [nova, setNova] = useState(false)
  const resumo = resumoRecebimentos(recebimentos, hoje)
  const orcamento = Number(projeto.orcamento_total ?? 0)
  const margem = resumo.recebido - totalGasto
  const semPlano = Math.max(orcamento - resumo.total, 0)
  const proximaOrdem = recebimentos.reduce((m, r) => Math.max(m, r.ordem + 1), 0)
  const obra = { id: projeto.id, empresa_id: projeto.empresa_id, cliente_id: projeto.cliente_id }

  function adicionar(novas: Recebimento[]) {
    onRecebimentosChange(
      [...recebimentos, ...novas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.ordem - b.ordem)
    )
    router.refresh()
  }

  if (!disponivel) {
    return (
      <Frame spacing="default">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletIcon />
            </EmptyMedia>
            <EmptyTitle>Financeiro ainda não ativado</EmptyTitle>
            <EmptyDescription>
              Falta rodar o SQL do financeiro no Supabase (supabase/migracoes/2026-11-27-financeiro.sql).
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Frame>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Recebido"
          valor={formatarMoeda(resumo.recebido)}
          detalhe={orcamento > 0 ? `${Math.round((resumo.recebido / orcamento) * 100)}% do orçamento` : undefined}
        />
        <Numero
          rotulo="A receber"
          valor={formatarMoeda(resumo.aReceber)}
          detalhe={
            resumo.atrasado > 0
              ? `${formatarMoeda(resumo.atrasado)} atrasado`
              : semPlano > 0 && resumo.total > 0
                ? `${formatarMoeda(semPlano)} sem parcela`
                : 'Nada atrasado'
          }
          alerta={resumo.atrasado > 0}
        />
        <Numero rotulo="Compras" valor={formatarMoeda(totalGasto)} detalhe="Gasto lançado na obra" />
        <Numero
          rotulo="Margem até agora"
          valor={formatarMoeda(margem)}
          detalhe="Recebido menos compras"
          alerta={margem < 0}
        />
      </Frame>

      <RecebimentosTabela
        recebimentos={recebimentos}
        onChange={onRecebimentosChange}
        hoje={hoje}
        vazio={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarRangeIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma parcela ainda</EmptyTitle>
              <EmptyDescription>
                {orcamento > 0
                  ? `Divida os ${formatarMoeda(orcamento)} da obra em parcelas, como 40/30/30.`
                  : 'Monte o plano de pagamento do cliente.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              <Button type="button" size="sm" onClick={() => setPlano(true)}>
                <CalendarRangeIcon data-icon="inline-start" />
                Plano de pagamento
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setNova(true)}>
                <PlusIcon data-icon="inline-start" />
                Uma parcela
              </Button>
            </EmptyContent>
          </Empty>
        }
      >
        <FrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Recebimentos</FrameTitle>
            <FrameDescription className="tabular-nums">
              {formatarMoeda(resumo.total)} em parcelas
              {orcamento > 0 ? ` de ${formatarMoeda(orcamento)} do orçamento` : ''}
            </FrameDescription>
          </div>
          {recebimentos.length > 0 && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPlano(true)}>
                <CalendarRangeIcon data-icon="inline-start" />
                Plano
              </Button>
              <Button type="button" size="sm" onClick={() => setNova(true)}>
                <PlusIcon data-icon="inline-start" />
                Nova parcela
              </Button>
            </div>
          )}
        </FrameHeader>
      </RecebimentosTabela>

      <NotasObra projeto={projeto} cliente={cliente} recebimentos={recebimentos} />

      <PlanoPagamentoDialog
        aberto={plano}
        onOpenChange={setPlano}
        obra={obra}
        totalObra={recebimentos.length > 0 ? semPlano : orcamento}
        jaTemParcelas={recebimentos.length > 0}
        proximaOrdem={proximaOrdem}
        hoje={hoje}
        onCriadas={adicionar}
      />
      <RecebimentoDialog
        aberto={nova}
        onOpenChange={setNova}
        obra={obra}
        recebimento={null}
        proximaOrdem={proximaOrdem}
        hoje={hoje}
        onSalvo={(r) => adicionar([r])}
      />
    </div>
  )
}
