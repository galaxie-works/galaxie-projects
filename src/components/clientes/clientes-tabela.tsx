'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { Building2Icon, FlameIcon, SearchIcon, SignpostIcon, UserIcon, UsersIcon } from 'lucide-react'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Filters } from '@/components/reui/filters/filters'
import { createFilterQuery, isFilterRule } from '@/components/reui/filters/filters-query'
import type {
  FilterField,
  FilterNode,
  FilterQuery,
  FilterRule,
} from '@/components/reui/filters/filters-types'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameFooter, FrameHeader, FramePanel } from '@/components/reui/frame'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { formatarData, formatarMoeda, iniciais } from '@/lib/formato'
import { situacaoFollowup } from '@/lib/crm'
import { VARIANTE_FASE_CLIENTE, VARIANTE_TEMPERATURA } from '@/lib/status'
import {
  FASE_CLIENTE_LABEL,
  FASES_CLIENTE,
  TEMPERATURA_LABEL,
  type Cliente,
  type FaseCliente,
  type TemperaturaCliente,
} from '@/types'
import { formatarTelefone } from './telefone'
import { ROTULOS_FILTROS, ROTULOS_GRID, ROTULOS_OPERADORES } from '@/lib/rotulos-tabela'

export type ClienteLinha = Cliente & {
  fase: FaseCliente
  contratado: number
  totalProjetos: number
}

const CAMPOS_FILTRO: FilterField[] = [
  {
    id: 'fase',
    label: 'Fase',
    type: 'select',
    defaultOperator: 'is_any_of',
    searchable: false,
    icon: <SignpostIcon />,
    options: FASES_CLIENTE.map((f) => ({ value: f, label: FASE_CLIENTE_LABEL[f] })),
  },
  {
    id: 'temperatura',
    label: 'Temperatura',
    type: 'select',
    defaultOperator: 'is_any_of',
    searchable: false,
    icon: <FlameIcon />,
    options: (Object.keys(TEMPERATURA_LABEL) as TemperaturaCliente[]).map((t) => ({
      value: t,
      label: TEMPERATURA_LABEL[t],
    })),
  },
  {
    id: 'tipo',
    label: 'Tipo',
    type: 'select',
    defaultOperator: 'is_any_of',
    searchable: false,
    icon: <UsersIcon />,
    options: [
      { value: 'PF', label: 'Pessoa física', icon: <UserIcon /> },
      { value: 'PJ', label: 'Pessoa jurídica', icon: <Building2Icon /> },
    ],
  },
]

function atendeRegra(cliente: ClienteLinha, regra: FilterRule): boolean {
  const atual = String(cliente[regra.path[0] as keyof ClienteLinha] ?? '')
  const valor = regra.value
  const lista = Array.isArray(valor) ? valor.map(String) : []
  const resultado = (() => {
    switch (regra.operator) {
      case 'is':
        return atual === String(valor)
      case 'is_not':
        return atual !== String(valor)
      case 'is_any_of':
        return lista.length === 0 || lista.includes(atual)
      case 'is_none_of':
        return !lista.includes(atual)
      case 'empty':
        return atual === ''
      case 'not_empty':
        return atual !== ''
      default:
        return true
    }
  })()
  return regra.negated ? !resultado : resultado
}

function atende(cliente: ClienteLinha, no: FilterNode): boolean {
  if (isFilterRule(no)) {
    const semValor =
      no.operator !== 'empty' &&
      no.operator !== 'not_empty' &&
      (no.value === undefined || (Array.isArray(no.value) && no.value.length === 0))
    return no.operator === '' || semValor || atendeRegra(cliente, no)
  }
  if (no.rules.length === 0) return true
  return no.combinator === 'and'
    ? no.rules.every((filho) => atende(cliente, filho))
    : no.rules.some((filho) => atende(cliente, filho))
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function casaBusca(cliente: ClienteLinha, busca: string): boolean {
  const termo = normalizar(busca.trim())
  if (!termo) return true
  const texto = normalizar(
    [cliente.nome, cliente.razao_social, cliente.email, cliente.cpf, cliente.cnpj, cliente.telefone]
      .filter(Boolean)
      .join(' ')
  )
  if (texto.includes(termo)) return true
  const digitosBusca = termo.replace(/\D/g, '')
  return digitosBusca.length >= 3 && texto.replace(/\D/g, '').includes(digitosBusca)
}

export function ClientesTabela({ clientes, hoje }: { clientes: ClienteLinha[]; hoje: string }) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [query, setQuery] = useState<FilterQuery>(() => createFilterQuery())
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>([])

  const linhas = useMemo(
    () => clientes.filter((c) => casaBusca(c, busca) && atende(c, query)),
    [clientes, busca, query]
  )

  const colunas = useMemo<ColumnDef<DataGridFeatures, ClienteLinha>[]>(
    () => [
      {
        id: 'nome',
        accessorKey: 'nome',
        header: ({ column }) => <DataGridColumnHeader title="Cliente" column={column} />,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar size="sm">
                <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/clientes/${c.id}`}
                  className="truncate font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.nome}
                </Link>
                {c.tipo === 'PJ' && c.razao_social && (
                  <span className="text-muted-foreground truncate text-xs">{c.razao_social}</span>
                )}
              </div>
            </div>
          )
        },
        size: 220,
        enableSorting: true,
      },
      {
        id: 'fase',
        // Ordena pela ordem do funil, não pelo nome da fase.
        accessorFn: (c) => FASES_CLIENTE.indexOf(c.fase),
        header: ({ column }) => <DataGridColumnHeader title="Fase" column={column} />,
        cell: ({ row }) => (
          <Badge variant={VARIANTE_FASE_CLIENTE[row.original.fase]}>
            {FASE_CLIENTE_LABEL[row.original.fase]}
          </Badge>
        ),
        size: 110,
        enableSorting: true,
      },
      {
        id: 'temperatura',
        accessorKey: 'temperatura',
        header: ({ column }) => <DataGridColumnHeader title="Temperatura" column={column} />,
        cell: ({ row }) => {
          const t = row.original.temperatura
          return t ? (
            <Badge variant={VARIANTE_TEMPERATURA[t]}>{TEMPERATURA_LABEL[t]}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
        size: 110,
        enableSorting: false,
      },
      {
        id: 'telefone',
        accessorKey: 'telefone',
        header: ({ column }) => <DataGridColumnHeader title="Telefone" column={column} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap tabular-nums">
            {formatarTelefone(row.original.telefone) || '—'}
          </span>
        ),
        size: 150,
        enableSorting: false,
      },
      {
        id: 'followup',
        accessorFn: (c) => c.proximo_followup_em ?? '',
        header: ({ column }) => <DataGridColumnHeader title="Próximo follow-up" column={column} />,
        cell: ({ row }) => {
          const data = row.original.proximo_followup_em ?? null
          const situacao = situacaoFollowup(data, hoje)
          if (situacao === 'sem') return <span className="text-muted-foreground">—</span>
          return (
            <span
              className={
                situacao === 'atrasado'
                  ? 'text-destructive-foreground whitespace-nowrap font-medium tabular-nums'
                  : 'whitespace-nowrap tabular-nums'
              }
            >
              {situacao === 'hoje' ? 'Hoje' : formatarData(data)}
            </span>
          )
        },
        size: 140,
        enableSorting: true,
      },
      {
        id: 'contratado',
        accessorKey: 'contratado',
        header: ({ column }) => <DataGridColumnHeader title="Contratado" column={column} />,
        cell: ({ row }) => formatarMoeda(row.original.contratado),
        size: 130,
        enableSorting: true,
        meta: {
          headerClassName: 'text-end [&>div]:justify-end',
          cellClassName: 'text-end tabular-nums whitespace-nowrap',
        },
      },
      {
        id: 'totalProjetos',
        accessorKey: 'totalProjetos',
        header: ({ column }) => <DataGridColumnHeader title="Obras" column={column} />,
        cell: ({ row }) => row.original.totalProjetos,
        size: 80,
        enableSorting: true,
        meta: {
          headerClassName: 'text-end [&>div]:justify-end',
          cellClassName: 'text-end tabular-nums',
        },
      },
    ],
    [hoje]
  )

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: linhas,
    pageCount: Math.ceil(linhas.length / pagination.pageSize),
    getRowId: (c: ClienteLinha) => c.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  })

  function voltarParaPrimeiraPagina() {
    setPagination((atual) => ({ ...atual, pageIndex: 0 }))
  }

  return (
    <DataGrid
      table={table}
      recordCount={linhas.length}
      i18n={ROTULOS_GRID}
      emptyMessage="Nenhum cliente encontrado com esses filtros."
      onRowClick={(c) => router.push(`/clientes/${c.id}`)}
      tableLayout={{ dense: true }}
      tableClassNames={{ base: 'min-w-[720px]' }}
    >
      <Frame spacing="default">
        <FrameHeader className="flex-row flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                voltarParaPrimeiraPagina()
              }}
              placeholder="Buscar nome, documento, e-mail"
              aria-label="Buscar clientes"
            />
          </InputGroup>
          <Filters
            fields={CAMPOS_FILTRO}
            query={query}
            onQueryChange={(proxima) => {
              setQuery(proxima)
              voltarParaPrimeiraPagina()
            }}
            labels={ROTULOS_FILTROS}
            operatorLabels={ROTULOS_OPERADORES}
            size="sm"
            showClear
          />
        </FrameHeader>
        <FramePanel className="p-0">
          <DataGridContainer>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </FramePanel>
        <FrameFooter>
          <DataGridPagination sizes={[10, 25, 50]} />
        </FrameFooter>
      </Frame>
    </DataGrid>
  )
}
