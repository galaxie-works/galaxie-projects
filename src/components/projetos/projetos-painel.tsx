'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTable, type ColumnDef, type PaginationState, type SortingState } from '@tanstack/react-table'
import { AlertCircleIcon, FolderPlusIcon, PlusIcon } from 'lucide-react'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { VARIANTE_STATUS_PROJETO } from '@/lib/status'
import { STATUS_PROJETO_LABEL, type Projeto, type StatusProjeto } from '@/types'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/reui/alert'
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
import { Filters } from '@/components/reui/filters/filters'
import { createFilterQuery } from '@/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@/components/reui/filters/filters-types'
import { Frame, FrameFooter, FrameHeader, FramePanel, FrameDescription, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ROTULOS_FILTROS, ROTULOS_GRID, ROTULOS_OPERADORES } from '@/lib/rotulos-tabela'
import { aplicarFiltroSelect } from '@/components/projetos/filtro-select'

export type LinhaProjeto = Projeto & { gasto: number; atrasado: boolean }

type Props = {
  projetos: LinhaProjeto[]
  erro?: string | null
}

const COLUNA_NUMERICA = {
  headerClassName: 'text-end [&>div]:justify-end',
  cellClassName: 'text-end tabular-nums',
}

export function ProjetosPainel({ projetos, erro }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState<FilterQuery>(() => createFilterQuery())
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const campos = useMemo<FilterField[]>(() => {
    const clientes = new Map<string, string>()
    projetos.forEach((p) => clientes.set(p.cliente_id, p.clientes?.nome ?? 'Sem nome'))
    return [
      {
        id: 'status',
        label: 'Status',
        type: 'select',
        defaultOperator: 'is_any_of',
        options: (Object.entries(STATUS_PROJETO_LABEL) as [StatusProjeto, string][]).map(
          ([value, label]) => ({ value, label })
        ),
      },
      {
        id: 'cliente',
        label: 'Cliente',
        type: 'select',
        defaultOperator: 'is_any_of',
        options: [...clientes].map(([value, label]) => ({ value, label })),
      },
    ]
  }, [projetos])

  const filtrados = useMemo(
    () =>
      aplicarFiltroSelect(projetos, query, (p, campo) =>
        campo === 'status' ? p.status : campo === 'cliente' ? p.cliente_id : undefined
      ),
    [projetos, query]
  )

  const kpis = useMemo(() => {
    const orcamento = projetos.reduce((s, p) => s + Number(p.orcamento_total ?? 0), 0)
    const gasto = projetos.reduce((s, p) => s + p.gasto, 0)
    return {
      emExecucao: projetos.filter((p) => p.status === 'em_execucao').length,
      atrasados: projetos.filter((p) => p.atrasado).length,
      ativos: projetos.filter((p) => p.status !== 'completo').length,
      orcamento,
      gasto,
      consumo: orcamento > 0 ? Math.round((gasto / orcamento) * 100) : 0,
    }
  }, [projetos])

  const totais = useMemo(
    () => ({
      orcamento: filtrados.reduce((s, p) => s + Number(p.orcamento_total ?? 0), 0),
      gasto: filtrados.reduce((s, p) => s + p.gasto, 0),
    }),
    [filtrados]
  )

  const colunas = useMemo<ColumnDef<DataGridFeatures, LinhaProjeto>[]>(
    () => [
      {
        accessorKey: 'nome',
        id: 'nome',
        header: ({ column }) => <DataGridColumnHeader title="Obra" column={column} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={`/projetos/${row.original.id}`}
              className="truncate font-medium text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.nome}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {row.original.clientes?.nome ?? 'Sem cliente'}
            </span>
          </div>
        ),
        size: 260,
        meta: { skeleton: <Skeleton className="h-8 w-40" /> },
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
        cell: ({ row }) => (
          <Badge variant={VARIANTE_STATUS_PROJETO[row.original.status]}>
            {STATUS_PROJETO_LABEL[row.original.status]}
          </Badge>
        ),
        size: 130,
        meta: { skeleton: <Skeleton className="h-5 w-20" /> },
      },
      {
        accessorKey: 'percentual_conclusao',
        id: 'progresso',
        header: ({ column }) => <DataGridColumnHeader title="Progresso" column={column} />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Progress
              value={row.original.percentual_conclusao}
              className="w-20"
              aria-label={`Progresso de ${row.original.nome}`}
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.original.percentual_conclusao}%
            </span>
          </div>
        ),
        size: 150,
        meta: { skeleton: <Skeleton className="h-2 w-24" /> },
      },
      {
        accessorKey: 'data_prazo',
        id: 'prazo',
        header: ({ column }) => <DataGridColumnHeader title="Prazo" column={column} />,
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <span className="tabular-nums">{formatarData(row.original.data_prazo)}</span>
            {row.original.atrasado && <Badge variant="destructive-light">Atrasada</Badge>}
          </div>
        ),
        size: 130,
        meta: { skeleton: <Skeleton className="h-4 w-20" /> },
      },
      {
        accessorFn: (p) => Number(p.orcamento_total ?? 0),
        id: 'orcamento',
        header: ({ column }) => <DataGridColumnHeader title="Orçamento" column={column} />,
        cell: ({ row }) => formatarMoeda(Number(row.original.orcamento_total ?? 0)),
        size: 140,
        meta: { ...COLUNA_NUMERICA, skeleton: <Skeleton className="ml-auto h-4 w-20" /> },
      },
      {
        accessorKey: 'gasto',
        id: 'gasto',
        header: ({ column }) => <DataGridColumnHeader title="Gasto" column={column} />,
        cell: ({ row }) => formatarMoeda(row.original.gasto),
        size: 140,
        meta: { ...COLUNA_NUMERICA, skeleton: <Skeleton className="ml-auto h-4 w-20" /> },
      },
    ],
    []
  )

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: filtrados,
    getRowId: (p: LinhaProjeto) => p.id,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  const rodape = (
    <DataGridTableFootRow>
      <DataGridTableFootRowCell colSpan={4}>
        <span className="text-muted-foreground">
          Total de {filtrados.length} {filtrados.length === 1 ? 'obra' : 'obras'}
        </span>
      </DataGridTableFootRowCell>
      <DataGridTableFootRowCell className="text-end font-semibold tabular-nums">
        {formatarMoeda(totais.orcamento)}
      </DataGridTableFootRowCell>
      <DataGridTableFootRowCell className="text-end font-semibold tabular-nums">
        {formatarMoeda(totais.gasto)}
      </DataGridTableFootRowCell>
    </DataGridTableFootRow>
  )

  const cabecalho = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Projetos</h1>
      </div>
      <Button nativeButton={false} render={<Link href="/projetos/novo" />}>
        <PlusIcon data-icon="inline-start" />
        Novo projeto
      </Button>
    </div>
  )

  if (erro) {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertTitle>Não foi possível carregar as obras</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
              Tentar de novo
            </Button>
          </AlertAction>
        </Alert>
      </div>
    )
  }

  if (projetos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <Frame spacing="default">
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderPlusIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma obra ainda</EmptyTitle>
                <EmptyDescription>Cadastre a primeira e acompanhe etapas e gastos.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button nativeButton={false} render={<Link href="/projetos/novo" />}>
                  <PlusIcon data-icon="inline-start" />
                  Criar primeiro projeto
                </Button>
              </EmptyContent>
            </Empty>
          </FramePanel>
        </Frame>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}

      <Frame spacing="default" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Em execução" valor={String(kpis.emExecucao)} meta={`${kpis.ativos} obras ativas`} />
        <Kpi
          rotulo="Atrasadas"
          valor={String(kpis.atrasados)}
          meta={kpis.atrasados > 0 ? 'Prazo final vencido' : 'Tudo dentro do prazo'}
          alerta={kpis.atrasados > 0}
        />
        <Kpi rotulo="Orçamento total" valor={formatarMoeda(kpis.orcamento)} meta="Soma de todas as obras" />
        <FramePanel className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Gasto total</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatarMoeda(kpis.gasto)}
          </span>
          <div className="flex items-center gap-2">
            <Progress
              value={Math.min(100, kpis.consumo)}
              className="flex-1"
              aria-label="Gasto em relação ao orçamento"
            />
            <span className="text-xs text-muted-foreground tabular-nums">{kpis.consumo}%</span>
          </div>
        </FramePanel>
      </Frame>

      <DataGrid
        table={table}
        recordCount={filtrados.length}
        i18n={ROTULOS_GRID}
        tableClassNames={{ base: 'min-w-[860px]' }}
        onRowClick={(p) => router.push(`/projetos/${p.id}`)}
        emptyMessage={
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-sm text-muted-foreground">Nenhuma obra com esses filtros.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setQuery(createFilterQuery())}>
              Limpar filtros
            </Button>
          </div>
        }
      >
        <Frame spacing="sm" stacked dense>
          <FrameHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Obras</FrameTitle>
              <FrameDescription>
                {filtrados.length} de {projetos.length}
              </FrameDescription>
            </div>
            <Filters
              fields={campos}
              query={query}
              onQueryChange={(q) => {
                setQuery(q)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              labels={ROTULOS_FILTROS}
              operatorLabels={ROTULOS_OPERADORES}
              size="sm"
              showClear
            />
          </FrameHeader>
          <FramePanel className="p-0">
            <DataGridScrollArea>
              <DataGridTable footerContent={rodape} />
            </DataGridScrollArea>
          </FramePanel>
          {filtrados.length > pagination.pageSize && (
            <FrameFooter>
              <DataGridPagination sizes={[10, 25, 50]} />
            </FrameFooter>
          )}
        </Frame>
      </DataGrid>
    </div>
  )
}

function Kpi({
  rotulo,
  valor,
  meta,
  alerta,
}: {
  rotulo: string
  valor: string
  meta: string
  alerta?: boolean
}) {
  return (
    <FramePanel className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{valor}</span>
      {alerta ? (
        <Badge variant="destructive-light" className="self-start">
          {meta}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">{meta}</span>
      )}
    </FramePanel>
  )
}
