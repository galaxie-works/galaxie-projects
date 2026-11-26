'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTable, type ColumnDef, type PaginationState, type SortingState } from '@tanstack/react-table'
import { EllipsisIcon, PlusIcon, ShoppingCartIcon, Trash2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Compra, MembroEquipe } from '@/types'
import { DataGrid, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import {
  DataGridTable,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
} from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ROTULOS_GRID } from '@/lib/rotulos-tabela'
import { CompraDialog } from '@/components/projetos/compra-dialog'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'

type Props = {
  projetoId: string
  compras: Compra[]
  onComprasChange: (compras: Compra[]) => void
  equipe: MembroEquipe[]
}

export function ComprasTabela({ projetoId, compras, onComprasChange, equipe }: Props) {
  const router = useRouter()
  const [adicionando, setAdicionando] = useState(false)
  const [excluir, setExcluir] = useState<Compra | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const total = useMemo(() => compras.reduce((s, c) => s + Number(c.valor), 0), [compras])

  const colunas = useMemo<ColumnDef<DataGridFeatures, Compra>[]>(
    () => [
      {
        accessorKey: 'descricao',
        id: 'descricao',
        header: ({ column }) => <DataGridColumnHeader title="Descrição" column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.descricao}</span>,
        size: 300,
      },
      {
        accessorFn: (c) => c.equipe?.nome ?? '',
        id: 'responsavel',
        header: ({ column }) => <DataGridColumnHeader title="Quem comprou" column={column} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.equipe?.nome ?? '—'}</span>
        ),
        size: 160,
      },
      {
        accessorFn: (c) => c.data ?? '',
        id: 'data',
        header: ({ column }) => <DataGridColumnHeader title="Data" column={column} />,
        cell: ({ row }) => <span className="tabular-nums">{formatarData(row.original.data)}</span>,
        size: 130,
      },
      {
        accessorFn: (c) => Number(c.valor),
        id: 'valor',
        header: ({ column }) => <DataGridColumnHeader title="Valor" column={column} />,
        cell: ({ row }) => formatarMoeda(Number(row.original.valor)),
        size: 140,
        meta: {
          headerClassName: 'text-end [&>div]:justify-end',
          cellClassName: 'text-end tabular-nums font-medium',
        },
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Ações da compra ${row.original.descricao}`}
                />
              }
            >
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setExcluir(row.original)}>
                <Trash2Icon />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 56,
        enableSorting: false,
        meta: { cellClassName: 'text-end' },
      },
    ],
    []
  )

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: compras,
    getRowId: (c: Compra) => c.id,
    autoResetPageIndex: false,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  function aoSalvar(nova: Compra) {
    onComprasChange([nova, ...compras])
    router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return false
    const { error } = await createClient().from('compras').delete().eq('id', excluir.id)
    if (error) {
      toast.error('Não foi possível excluir a compra', { description: error.message })
      return false
    }
    onComprasChange(compras.filter((c) => c.id !== excluir.id))
    toast.success('Compra excluída')
    router.refresh()
    return true
  }

  const rodape = (
    <DataGridTableFootRow>
      <DataGridTableFootRowCell colSpan={3}>
        <span className="text-muted-foreground">
          Total de {compras.length} {compras.length === 1 ? 'compra' : 'compras'}
        </span>
      </DataGridTableFootRowCell>
      <DataGridTableFootRowCell className="text-end font-semibold tabular-nums">
        {formatarMoeda(total)}
      </DataGridTableFootRowCell>
      <DataGridTableFootRowCell />
    </DataGridTableFootRow>
  )

  return (
    <>
      <DataGrid
        table={table}
        recordCount={compras.length}
        i18n={ROTULOS_GRID}
        tableClassNames={{ base: 'min-w-[720px]' }}
        emptyMessage={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingCartIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma compra registrada</EmptyTitle>
              <EmptyDescription>Lance materiais e serviços para acompanhar o gasto.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" size="sm" onClick={() => setAdicionando(true)}>
                <PlusIcon data-icon="inline-start" />
                Registrar compra
              </Button>
            </EmptyContent>
          </Empty>
        }
      >
        <Frame spacing="sm" stacked dense>
          <FrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Compras e materiais</FrameTitle>
              <FrameDescription className="tabular-nums">{formatarMoeda(total)} no total</FrameDescription>
            </div>
            {compras.length > 0 && (
              <Button type="button" size="sm" onClick={() => setAdicionando(true)}>
                <PlusIcon data-icon="inline-start" />
                Nova compra
              </Button>
            )}
          </FrameHeader>
          <FramePanel className="p-0">
            <DataGridScrollArea>
              <DataGridTable footerContent={compras.length > 0 ? rodape : undefined} />
            </DataGridScrollArea>
          </FramePanel>
          {compras.length > pagination.pageSize && (
            <FrameFooter>
              <DataGridPagination sizes={[10, 25, 50]} />
            </FrameFooter>
          )}
        </Frame>
      </DataGrid>

      <CompraDialog
        aberto={adicionando}
        onOpenChange={setAdicionando}
        projetoId={projetoId}
        equipe={equipe}
        onSalva={aoSalvar}
      />
      <ConfirmarExclusao
        aberto={excluir !== null}
        onOpenChange={(v) => !v && setExcluir(null)}
        titulo="Excluir esta compra?"
        descricao={excluir ? `“${excluir.descricao}” deixa de contar no gasto da obra.` : ''}
        rotulo="Excluir compra"
        onConfirmar={confirmarExclusao}
      />
    </>
  )
}
