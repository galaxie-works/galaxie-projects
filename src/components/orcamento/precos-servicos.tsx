'use client'

import { useTable, type ColumnDef } from '@tanstack/react-table'
import { TagIcon } from 'lucide-react'
import {
  LISTA_UNIDADES,
  UNIDADES,
  unidadePadrao,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'
import { SERVICOS_POR_ID } from '@/lib/servicos'
import { formatarMoeda } from '@/lib/formato'
import { ROTULOS_GRID } from '@/lib/rotulos-tabela'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridCellsChangeDetails,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridCellSelection } from '@/components/reui/data-grid/data-grid-cell-selection'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  servicos: string[]
  precos: TabelaPrecos
  onChange: (precos: TabelaPrecos) => void
}

// Tabela de preços: para cada serviço da empresa, como cobra (m², metro
// linear, unidade…) e quanto. Vem preenchida em cada orçamento novo.
export function PrecosServicos({ servicos, precos, onChange }: Props) {
  // Uma linha por serviço, na ordem da taxonomia (agrupa por categoria).
  const ordem = Object.keys(SERVICOS_POR_ID)
  const linhas: LinhaPreco[] = servicos
    .filter((id) => SERVICOS_POR_ID[id])
    .sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
    .map((id) => {
      const p = precos[id] ?? { unidade: unidadePadrao(id), preco: 0 }
      const c = SERVICOS_POR_ID[id]
      return {
        id,
        nome: c.servico.nome,
        categoria: c.categoria.nome,
        unidade: p.unidade,
        preco: p.preco,
      }
    })

  if (servicos.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TagIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhum serviço escolhido</EmptyTitle>
          <EmptyDescription>
            Marque seus serviços na aba Serviços para definir os preços.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  function mudar(id: string, parcial: Partial<{ unidade: Unidade; preco: number }>) {
    const atual = precos[id] ?? { unidade: unidadePadrao(id), preco: 0 }
    onChange({ ...precos, [id]: { ...atual, ...parcial } })
  }

  function mudarVarios(mudancas: { id: string; preco: number }[]) {
    const novo = { ...precos }
    for (const m of mudancas)
      novo[m.id] = { ...(novo[m.id] ?? { unidade: unidadePadrao(m.id), preco: 0 }), preco: m.preco }
    onChange(novo)
  }

  return <TabelaPrecosGrid linhas={linhas} onMudar={mudar} onMudarVarios={mudarVarios} />
}

type LinhaPreco = { id: string; nome: string; categoria: string; unidade: Unidade; preco: number }

// Lê "140", "140,50", "R$ 1.234,56" como número.
function lerMoeda(texto: string): number | undefined {
  const limpo = texto
    .replace(/[^\d.,]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  if (!limpo) return 0
  const n = Number(limpo)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

// Mesma aparência do exemplo de edição em célula da ReUI (c-data-grid-31).
const GATILHO_CELULA =
  'h-6 w-full border-0 bg-transparent px-1 shadow-none [&_svg]:opacity-0 [&_svg]:transition-opacity in-data-[cell-focused]:[&_svg]:opacity-100'

function TabelaPrecosGrid({
  linhas,
  onMudar,
  onMudarVarios,
}: {
  linhas: LinhaPreco[]
  onMudar: (id: string, parcial: Partial<{ unidade: Unidade; preco: number }>) => void
  onMudarVarios: (mudancas: { id: string; preco: number }[]) => void
}) {
  const colunas: ColumnDef<DataGridFeatures, LinhaPreco>[] = [
    {
      id: 'servico',
      accessorFn: (l) => l.nome,
      header: 'Serviço',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{row.original.nome}</span>
          <span className="text-xs text-muted-foreground">{row.original.categoria}</span>
        </span>
      ),
      size: 260,
      meta: { headerTitle: 'Serviço', autoSize: true },
    },
    {
      id: 'unidade',
      accessorFn: (l) => UNIDADES[l.unidade].nome,
      header: 'Cobra por',
      cell: ({ row }) => (
        <Select
          items={LISTA_UNIDADES}
          value={row.original.unidade}
          onValueChange={(v) => v && onMudar(row.original.id, { unidade: v as Unidade })}
        >
          <SelectTrigger
            size="sm"
            className={GATILHO_CELULA}
            aria-label={`Como cobra ${row.original.nome}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" sideOffset={8}>
            {LISTA_UNIDADES.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
      size: 200,
      meta: { headerTitle: 'Cobra por' },
    },
    {
      id: 'preco',
      accessorFn: (l) => l.preco,
      header: 'Preço',
      cell: ({ row }) =>
        row.original.preco ? (
          `${formatarMoeda(row.original.preco)} / ${UNIDADES[row.original.unidade].curto}`
        ) : (
          <span className="text-xs text-muted-foreground">Definir preço</span>
        ),
      size: 160,
      meta: {
        headerTitle: 'Preço',
        headerClassName: 'text-end [&>div]:justify-end',
        cellClassName: 'text-end tabular-nums',
        cellEdit: {
          control: 'text',
          parse: (raw) => lerMoeda(raw),
          format: (v) =>
            typeof v === 'number' && v > 0
              ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              : '',
          clearValue: 0,
        },
      },
    },
  ]

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: linhas,
    getRowId: (l: LinhaPreco) => l.id,
  })

  return (
    <DataGrid
      table={table}
      recordCount={linhas.length}
      i18n={ROTULOS_GRID}
      onCellsChange={(d: DataGridCellsChangeDetails<LinhaPreco>) =>
        onMudarVarios(
          d.changes
            .filter((c) => c.columnId === 'preco')
            .map((c) => ({ id: c.rowId, preco: Number(c.value ?? 0) })),
        )
      }
      tableLayout={{
        dense: true,
        cellSelection: true,
        cellEditMode: 'click',
        cellBorder: true,
      }}
      tableClassNames={{ base: 'min-w-[560px]', edgeCell: 'first:ps-4 last:pe-4' }}
    >
      <DataGridContainer>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
        <DataGridCellSelection />
      </DataGridContainer>
    </DataGrid>
  )
}
