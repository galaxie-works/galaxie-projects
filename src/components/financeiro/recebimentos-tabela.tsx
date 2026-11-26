'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTable, type ColumnDef, type PaginationState, type SortingState } from '@tanstack/react-table'
import { CheckIcon, EllipsisIcon, PencilIcon, Trash2Icon, Undo2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { SITUACAO_LABEL, VARIANTE_SITUACAO, situacaoRecebimento } from '@/lib/financeiro'
import { FORMA_PAGAMENTO_LABEL, type Recebimento } from '@/types'
import { Badge } from '@/components/reui/badge'
import { DataGrid, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import {
  DataGridTable,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
} from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROTULOS_GRID } from '@/lib/rotulos-tabela'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { ReceberDialog } from './receber-dialog'
import { RecebimentoDialog } from './recebimento-dialog'

type Props = {
  recebimentos: Recebimento[]
  onChange: (lista: Recebimento[]) => void
  hoje: string
  /** Mostra a coluna Obra (no cliente e na tela Financeiro). */
  mostrarObra?: boolean
  /** Mostra a coluna Cliente (na tela Financeiro). */
  mostrarCliente?: boolean
  /** Conteúdo quando não há parcelas. */
  vazio: React.ReactNode
  /** Cabeçalho (FrameHeader) do quadro. */
  children?: React.ReactNode
  tamanhoPagina?: number
}

// Lista de parcelas com baixa rápida, edição e exclusão. Fica dentro de um
// Frame que quem usa monta (para pôr título e botões no cabeçalho).
export function RecebimentosTabela({
  recebimentos,
  onChange,
  hoje,
  mostrarObra,
  mostrarCliente,
  vazio,
  children,
  tamanhoPagina = 10,
}: Props) {
  const router = useRouter()
  const [receber, setReceber] = useState<Recebimento | null>(null)
  const [editar, setEditar] = useState<Recebimento | null>(null)
  const [excluir, setExcluir] = useState<Recebimento | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: tamanhoPagina })

  function trocar(r: Recebimento) {
    onChange(recebimentos.map((x) => (x.id === r.id ? { ...x, ...r, projetos: x.projetos } : x)))
    router.refresh()
  }

  async function desfazer(r: Recebimento) {
    const { error } = await createClient().from('recebimentos').update({ recebido_em: null }).eq('id', r.id)
    if (error) {
      toast.error('Não foi possível desfazer', { description: error.message })
      return
    }
    toast.success('Parcela voltou para a receber')
    trocar({ ...r, recebido_em: null })
  }

  async function confirmarExclusao() {
    if (!excluir) return false
    const { error } = await createClient().from('recebimentos').delete().eq('id', excluir.id)
    if (error) {
      toast.error('Não foi possível excluir a parcela', { description: error.message })
      return false
    }
    onChange(recebimentos.filter((r) => r.id !== excluir.id))
    toast.success('Parcela excluída')
    router.refresh()
    return true
  }

  const colunas = useMemo<ColumnDef<DataGridFeatures, Recebimento>[]>(() => {
    const lista: ColumnDef<DataGridFeatures, Recebimento>[] = [
      {
        accessorKey: 'descricao',
        id: 'descricao',
        header: ({ column }) => <DataGridColumnHeader title="Parcela" column={column} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.descricao}</span>,
        size: 200,
      },
    ]
    if (mostrarCliente) {
      lista.push({
        accessorFn: (r) => r.projetos?.clientes?.nome ?? '',
        id: 'cliente',
        header: ({ column }) => <DataGridColumnHeader title="Cliente" column={column} />,
        cell: ({ row }) =>
          row.original.projetos ? (
            <Link href={`/clientes/${row.original.projetos.cliente_id}`} className="hover:underline">
              {row.original.projetos.clientes?.nome ?? '—'}
            </Link>
          ) : (
            '—'
          ),
        size: 180,
      })
    }
    if (mostrarObra) {
      lista.push({
        accessorFn: (r) => r.projetos?.nome ?? '',
        id: 'obra',
        header: ({ column }) => <DataGridColumnHeader title="Obra" column={column} />,
        cell: ({ row }) => (
          <Link href={`/projetos/${row.original.projeto_id}`} className="text-muted-foreground hover:underline">
            {row.original.projetos?.nome ?? '—'}
          </Link>
        ),
        size: 180,
      })
    }
    lista.push(
      {
        accessorFn: (r) => r.vencimento,
        id: 'vencimento',
        header: ({ column }) => <DataGridColumnHeader title="Vencimento" column={column} />,
        cell: ({ row }) => <span className="tabular-nums">{formatarData(row.original.vencimento)}</span>,
        size: 130,
      },
      {
        accessorFn: (r) => situacaoRecebimento(r, hoje),
        id: 'situacao',
        header: ({ column }) => <DataGridColumnHeader title="Situação" column={column} />,
        cell: ({ row }) => {
          const r = row.original
          const s = situacaoRecebimento(r, hoje)
          return (
            <div className="flex flex-col items-start gap-0.5">
              <Badge variant={VARIANTE_SITUACAO[s]}>{SITUACAO_LABEL[s]}</Badge>
              {r.recebido_em && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatarData(r.recebido_em)}
                  {r.forma ? ` · ${FORMA_PAGAMENTO_LABEL[r.forma]}` : ''}
                </span>
              )}
            </div>
          )
        },
        size: 150,
      },
      {
        accessorFn: (r) => Number(r.valor),
        id: 'valor',
        header: ({ column }) => <DataGridColumnHeader title="Valor" column={column} />,
        cell: ({ row }) => formatarMoeda(Number(row.original.valor)),
        size: 130,
        meta: {
          headerClassName: 'text-end [&>div]:justify-end',
          cellClassName: 'text-end tabular-nums font-medium',
        },
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              {!r.recebido_em && (
                <Button type="button" variant="outline" size="xs" onClick={() => setReceber(r)}>
                  <CheckIcon data-icon="inline-start" />
                  Recebi
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Ações da parcela ${r.descricao}`} />
                  }
                >
                  <EllipsisIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditar(r)}>
                    <PencilIcon />
                    Editar
                  </DropdownMenuItem>
                  {r.recebido_em && (
                    <DropdownMenuItem onClick={() => desfazer(r)}>
                      <Undo2Icon />
                      Desfazer recebimento
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setExcluir(r)}>
                    <Trash2Icon />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        size: 120,
        enableSorting: false,
        meta: { cellClassName: 'text-end' },
      }
    )
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarObra, mostrarCliente, hoje, recebimentos])

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: recebimentos,
    getRowId: (r: Recebimento) => r.id,
    autoResetPageIndex: false,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  const total = recebimentos.reduce((s, r) => s + Number(r.valor), 0)
  const colunasAntes = colunas.length - 2

  const rodape = (
    <DataGridTableFootRow>
      <DataGridTableFootRowCell colSpan={colunasAntes}>
        <span className="text-muted-foreground">
          {recebimentos.length} {recebimentos.length === 1 ? 'parcela' : 'parcelas'}
        </span>
      </DataGridTableFootRowCell>
      <DataGridTableFootRowCell className="text-end font-semibold tabular-nums">
        {formatarMoeda(total)}
      </DataGridTableFootRowCell>
      <DataGridTableFootRowCell />
    </DataGridTableFootRow>
  )

  const largura = mostrarObra && mostrarCliente ? 'min-w-[1080px]' : mostrarObra ? 'min-w-[900px]' : 'min-w-[720px]'

  return (
    <>
      <DataGrid
        table={table}
        recordCount={recebimentos.length}
        i18n={ROTULOS_GRID}
        tableClassNames={{ base: largura }}
        emptyMessage={vazio}
      >
        <Frame spacing="sm" stacked dense>
          {children}
          <FramePanel className="p-0">
            <DataGridScrollArea>
              <DataGridTable footerContent={recebimentos.length > 0 ? rodape : undefined} />
            </DataGridScrollArea>
          </FramePanel>
          {recebimentos.length > pagination.pageSize && (
            <FrameFooter>
              <DataGridPagination sizes={[10, 25, 50]} />
            </FrameFooter>
          )}
        </Frame>
      </DataGrid>

      <ReceberDialog recebimento={receber} onOpenChange={(v) => !v && setReceber(null)} hoje={hoje} onSalvo={trocar} />
      {editar && (
        <RecebimentoDialog
          aberto
          onOpenChange={(v) => !v && setEditar(null)}
          obra={{ id: editar.projeto_id, empresa_id: editar.empresa_id, cliente_id: editar.cliente_id ?? '' }}
          recebimento={editar}
          proximaOrdem={editar.ordem}
          hoje={hoje}
          onSalvo={trocar}
        />
      )}
      <ConfirmarExclusao
        aberto={excluir !== null}
        onOpenChange={(v) => !v && setExcluir(null)}
        titulo="Excluir esta parcela?"
        descricao={excluir ? `“${excluir.descricao}” de ${formatarMoeda(Number(excluir.valor))} sai do financeiro.` : ''}
        rotulo="Excluir parcela"
        onConfirmar={confirmarExclusao}
      />
    </>
  )
}
