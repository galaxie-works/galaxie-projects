'use client'

import { useState } from 'react'
import { WalletIcon } from 'lucide-react'
import { formatarMoeda } from '@/lib/formato'
import { resumoRecebimentos } from '@/lib/financeiro'
import type { Recebimento } from '@/types'
import { FrameDescription, FrameHeader, FrameTitle } from '@/components/reui/frame'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { RecebimentosTabela } from './recebimentos-tabela'

type Props = {
  recebimentos: Recebimento[]
  hoje: string
  temObras: boolean
}

// Aba Financeiro do cliente: parcelas de todas as obras dele.
export function FinanceiroCliente({ recebimentos: iniciais, hoje, temObras }: Props) {
  const [recebimentos, setRecebimentos] = useState(iniciais)
  const resumo = resumoRecebimentos(recebimentos, hoje)

  return (
    <RecebimentosTabela
      recebimentos={recebimentos}
      onChange={setRecebimentos}
      hoje={hoje}
      mostrarObra
      vazio={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma parcela</EmptyTitle>
            <EmptyDescription>
              {temObras
                ? 'Monte o plano de pagamento na aba Financeiro de cada obra.'
                : 'As parcelas aparecem aqui depois que o cliente tiver uma obra.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      <FrameHeader>
        <FrameTitle>Recebimentos</FrameTitle>
        <FrameDescription className="tabular-nums">
          {formatarMoeda(resumo.recebido)} recebido · {formatarMoeda(resumo.aReceber)} a receber
          {resumo.atrasado > 0 && (
            <span className="text-destructive"> · {formatarMoeda(resumo.atrasado)} atrasado</span>
          )}
        </FrameDescription>
      </FrameHeader>
    </RecebimentosTabela>
  )
}
