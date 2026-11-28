'use client'

import { useTable, type ColumnDef } from '@tanstack/react-table'
import { formatarMoeda } from '@/lib/formato'
import {
  UNIDADES,
  formatarQuantidade,
  quantidadePorUnidade,
  totalArea,
  totalOrcamento,
  totaisPorServico,
  type AreaOrcamento,
  type Unidade,
} from '@/lib/orcamento'
import { ROTULOS_GRID } from '@/lib/rotulos-tabela'
import {
  DataGrid,
  dataGridFeatures,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import {
  DataGridTable,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
} from '@/components/reui/data-grid/data-grid-table'
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Separator } from '@/components/ui/separator'

// Cores categóricas dos serviços na barra de composição (com par escuro).
const CORES = [
  'bg-blue-500 dark:bg-blue-400',
  'bg-amber-500 dark:bg-amber-400',
  'bg-emerald-500 dark:bg-emerald-400',
  'bg-violet-500 dark:bg-violet-400',
  'bg-rose-500 dark:bg-rose-400',
  'bg-cyan-500 dark:bg-cyan-400',
]
const ORDEM_UNIDADES: Unidade[] = ['m2', 'ml', 'un', 'm3', 'dia', 'vb']
const TITULO_UNIDADE: Record<Unidade, string> = {
  m2: 'Piso (m²)',
  ml: 'Metro linear',
  un: 'Unidades',
  m3: 'm³',
  dia: 'Diárias',
  vb: 'Verbas',
}

type Linha = { chave: string; nome: string; valor: number } & Partial<Record<Unidade, number>>

// Resumo no formato que o Wagner usa com o cliente: uma linha por área com
// m², metro linear e valor; embaixo, totais por unidade e por serviço.
export function OrcamentoResumo({ areas }: { areas: AreaOrcamento[] }) {
  const comItens = areas.filter((a) => a.itens.length > 0)
  const total = totalOrcamento(comItens)
  const porUnidade = quantidadePorUnidade(comItens)
  const unidades = ORDEM_UNIDADES.filter((u) => porUnidade[u] !== undefined)
  const servicos = totaisPorServico(comItens)

  const linhas: Linha[] = comItens.map((a, i) => ({
    chave: a.chave,
    nome: a.nome.trim() || `Área ${i + 1}`,
    valor: totalArea(a),
    ...quantidadePorUnidade(a),
  }))

  const colunas: ColumnDef<DataGridFeatures, Linha>[] = [
    {
      accessorKey: 'nome',
      id: 'nome',
      header: 'Área',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.nome}</span>,
      size: 220,
    },
    ...unidades.map<ColumnDef<DataGridFeatures, Linha>>((u) => ({
      id: u,
      accessorFn: (l) => l[u] ?? 0,
      header: TITULO_UNIDADE[u],
      cell: ({ row }) =>
        row.original[u] ? (
          formatarQuantidade(row.original[u]!)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      size: 120,
      meta: { headerClassName: 'text-end', cellClassName: 'text-end tabular-nums' },
    })),
    {
      accessorKey: 'valor',
      id: 'valor',
      header: 'Valor total',
      cell: ({ row }) => formatarMoeda(row.original.valor),
      size: 140,
      meta: { headerClassName: 'text-end', cellClassName: 'text-end tabular-nums font-medium' },
    },
  ]

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: linhas,
    getRowId: (l: Linha) => l.chave,
  })

  if (comItens.length === 0) return null

  const rodape = (
    <DataGridTableFootRow>
      <DataGridTableFootRowCell className="font-semibold">Total</DataGridTableFootRowCell>
      {unidades.map((u) => (
        <DataGridTableFootRowCell key={u} className="text-end font-semibold tabular-nums">
          {formatarQuantidade(porUnidade[u] ?? 0)}
        </DataGridTableFootRowCell>
      ))}
      <DataGridTableFootRowCell className="text-end font-semibold tabular-nums">
        {formatarMoeda(total)}
      </DataGridTableFootRowCell>
    </DataGridTableFootRow>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <DataGrid
        table={table}
        recordCount={linhas.length}
        i18n={ROTULOS_GRID}
        tableClassNames={{ base: 'min-w-[480px]' }}
      >
        <Frame spacing="sm" stacked dense className="min-w-0 self-start">
          <FrameHeader>
            <FrameTitle>Medidas por área</FrameTitle>
          </FrameHeader>
          <FramePanel className="p-0">
            <DataGridScrollArea>
              <DataGridTable footerContent={rodape} />
            </DataGridScrollArea>
          </FramePanel>
        </Frame>
      </DataGrid>

      <Frame spacing="default" className="min-w-0 self-start">
        <FrameHeader>
          <FrameTitle>Resumo do orçamento</FrameTitle>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {unidades.map((u) => (
              <Linha
                key={u}
                rotulo={`Total em ${UNIDADES[u].plural}`}
                valor={formatarQuantidade(porUnidade[u] ?? 0, u)}
              />
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            {servicos.map((s) => (
              <Linha key={s.chave} rotulo={s.nome} valor={formatarMoeda(s.total)} />
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground uppercase">Valor total da obra</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatarMoeda(total)}
            </span>
          </div>
          {total > 0 && servicos.length > 1 && (
            <div className="flex flex-col gap-2">
              <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label="Composição do orçamento por serviço"
              >
                {servicos.map((s, i) => (
                  <div
                    key={s.chave}
                    className={CORES[i % CORES.length]}
                    style={{ width: `${(s.total / total) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {servicos.map((s, i) => (
                  <span
                    key={s.chave}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className={`size-2 rounded-full ${CORES[i % CORES.length]}`} />
                    {s.nome} (
                    {((s.total / total) * 100).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}
                    %)
                  </span>
                ))}
              </div>
            </div>
          )}
        </FramePanel>
      </Frame>
    </div>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 text-muted-foreground">{rotulo}</span>
      <span className="shrink-0 font-medium tabular-nums">{valor}</span>
    </div>
  )
}
