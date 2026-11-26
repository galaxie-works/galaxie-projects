'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarMoeda } from '@/lib/formato'
import { totalOrcamento, type AreaOrcamento, type TabelaPrecos } from '@/lib/orcamento'
import { salvarOrcamento } from '@/components/orcamento/dados'
import { OrcamentoEditor } from '@/components/orcamento/orcamento-editor'
import { OrcamentoResumo } from '@/components/orcamento/orcamento-resumo'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

type Props = {
  projetoId: string
  empresaId: string
  areas: AreaOrcamento[]
  onAreasChange: (areas: AreaOrcamento[]) => void
  servicosEmpresa: string[]
  precos: TabelaPrecos
}

// Aba Orçamento do projeto: edita áreas e medidas e salva tudo de uma vez.
export function OrcamentoAba({
  projetoId,
  empresaId,
  areas,
  onAreasChange,
  servicosEmpresa,
  precos,
}: Props) {
  const router = useRouter()
  const [salvas, setSalvas] = useState(() => JSON.stringify(areas))
  const [salvando, setSalvando] = useState(false)
  const alterado = JSON.stringify(areas) !== salvas

  async function salvar() {
    setSalvando(true)
    const { erro } = await salvarOrcamento(createClient(), { projetoId, empresaId, areas, precos })
    setSalvando(false)
    if (erro) {
      toast.error('Não foi possível salvar o orçamento', { description: erro })
      return
    }
    setSalvas(JSON.stringify(areas))
    toast.success('Orçamento salvo', { description: formatarMoeda(totalOrcamento(areas)) })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <OrcamentoEditor
        areas={areas}
        onChange={onAreasChange}
        servicosEmpresa={servicosEmpresa}
        precos={precos}
      />
      <OrcamentoResumo areas={areas} />
      {alterado && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-full border bg-background/95 py-2 pr-2 pl-4 shadow-sm backdrop-blur animate-in fade-in duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <span className="text-sm text-muted-foreground">Alterações não salvas</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={salvando}
              onClick={() => onAreasChange(JSON.parse(salvas))}
            >
              Descartar
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={salvando}>
              {salvando && <Spinner data-icon="inline-start" />}
              Salvar orçamento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
