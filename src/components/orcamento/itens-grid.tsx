'use client'

import { useTable, type ColumnDef } from '@tanstack/react-table'
import { Trash2Icon } from 'lucide-react'
import { formatarMoeda } from '@/lib/formato'
import {
  LISTA_UNIDADES,
  UNIDADES,
  avaliarMedida,
  ehConta,
  formatarQuantidade,
  nomeServico,
  totalArea,
  totalItem,
  type ItemOrcamento,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'
import { ROTULOS_GRID } from '@/lib/rotulos-tabela'
import { SERVICOS_POR_ID } from '@/lib/servicos'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridCellsChangeDetails,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridCellSelection } from '@/components/reui/data-grid/data-grid-cell-selection'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import {
  DataGridTable,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
} from '@/components/reui/data-grid/data-grid-table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  itens: ItemOrcamento[]
  onChange: (itens: ItemOrcamento[]) => void
  onAdicionar: () => void
  servicosEmpresa: string[]
  precos: TabelaPrecos
}

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

// Mesma aparência do exemplo de edição em célula da ReUI (c-data-grid-31):
// o valor aparece como texto e a seta só no foco da célula.
const GATILHO_CELULA =
  'h-6 w-full border-0 bg-transparent px-1 shadow-none [&_svg]:opacity-0 [&_svg]:transition-opacity in-data-[cell-focused]:[&_svg]:opacity-100'

/**
 * Itens de uma área em planilha (data-grid da ReUI com edição na célula):
 * serviço, medida (aceita conta como "5 x 3,2 + 2"), unidade, preço e total,
 * com o subtotal da área no rodapé.
 */
export function ItensGrid({ itens, onChange, onAdicionar, servicosEmpresa, precos }: Props) {
  function atualizar(chave: string, parcial: Partial<ItemOrcamento>) {
    onChange(itens.map((i) => (i.chave === chave ? { ...i, ...parcial } : i)))
  }

  function aoEditar(details: DataGridCellsChangeDetails<ItemOrcamento>) {
    const porItem = new Map<string, Partial<ItemOrcamento>>()
    for (const c of details.changes) {
      const p = porItem.get(c.rowId) ?? {}
      if (c.columnId === 'medida') {
        const texto = String(c.value ?? '').trim()
        p.quantidade = texto ? (avaliarMedida(texto) ?? 0) : 0
        p.memoria_calculo = ehConta(texto) ? texto : null
      } else if (c.columnId === 'preco') {
        p.preco_unitario = Number(c.value ?? 0)
      }
      porItem.set(c.rowId, p)
    }
    onChange(itens.map((i) => (porItem.has(i.chave) ? { ...i, ...porItem.get(i.chave) } : i)))
  }

  function trocarServico(item: ItemOrcamento, servicoId: string) {
    const preco = precos[servicoId]
    atualizar(item.chave, {
      servico_id: servicoId,
      unidade: preco?.unidade ?? item.unidade,
      // Serviço sem preço na tabela começa em zero, não herda o do anterior.
      preco_unitario: preco?.preco ?? 0,
    })
  }

  // Serviços da empresa por categoria; mantém um serviço que a empresa
  // desmarcou depois, para ele não sumir do orçamento.
  function gruposDe(atual: string | null) {
    const ids =
      atual && !servicosEmpresa.includes(atual) ? [...servicosEmpresa, atual] : servicosEmpresa
    const mapa = new Map<string, { nome: string; itens: { value: string; label: string }[] }>()
    for (const sid of ids) {
      const c = SERVICOS_POR_ID[sid]
      if (!c) continue
      const g = mapa.get(c.categoria.id) ?? { nome: c.categoria.nome, itens: [] }
      g.itens.push({ value: sid, label: c.servico.nome })
      mapa.set(c.categoria.id, g)
    }
    return [...mapa.values()]
  }

  const colunas: ColumnDef<DataGridFeatures, ItemOrcamento>[] = [
    {
      id: 'servico',
      accessorFn: (i) => nomeServico(i),
      header: 'Serviço',
      cell: ({ row }) => {
        const grupos = gruposDe(row.original.servico_id)
        return (
          <Select
            items={grupos.flatMap((g) => g.itens)}
            value={row.original.servico_id ?? ''}
            onValueChange={(v) => v && trocarServico(row.original, v as string)}
          >
            <SelectTrigger size="sm" className={GATILHO_CELULA} aria-label="Serviço">
              <SelectValue placeholder="Escolha o serviço" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start" sideOffset={8}>
              {grupos.map((g) => (
                <SelectGroup key={g.nome}>
                  <SelectLabel>{g.nome}</SelectLabel>
                  {g.itens.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )
      },
      size: 220,
      meta: { headerTitle: 'Serviço', autoSize: true },
    },
    {
      id: 'medida',
      accessorFn: (i) =>
        i.memoria_calculo ?? (i.quantidade ? formatarQuantidade(i.quantidade) : ''),
      header: 'Medida',
      cell: ({ row }) => {
        const i = row.original
        if (!i.quantidade && !i.memoria_calculo)
          return <span className="text-xs text-muted-foreground">0 ou 5 x 3,2</span>
        return (
          <span className="flex flex-col">
            <span>{formatarQuantidade(i.quantidade)}</span>
            {i.memoria_calculo && (
              <span className="text-xs text-muted-foreground">{i.memoria_calculo}</span>
            )}
          </span>
        )
      },
      size: 120,
      meta: {
        headerTitle: 'Medida',
        headerClassName: 'text-end [&>div]:justify-end',
        cellClassName: 'text-end tabular-nums',
        cellEdit: {
          control: 'text',
          parse: (raw) =>
            raw.trim() === '' || avaliarMedida(raw) !== null ? raw.trim() : undefined,
          clearValue: '',
        },
      },
    },
    {
      id: 'unidade',
      accessorFn: (i) => UNIDADES[i.unidade].curto,
      header: 'Unid.',
      cell: ({ row }) => (
        <Select
          items={LISTA_UNIDADES}
          value={row.original.unidade}
          onValueChange={(v) => v && atualizar(row.original.chave, { unidade: v as Unidade })}
        >
          <SelectTrigger size="sm" className={GATILHO_CELULA} aria-label="Unidade">
            <SelectValue>{UNIDADES[row.original.unidade].curto}</SelectValue>
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
      size: 80,
      meta: { headerTitle: 'Unidade' },
    },
    {
      id: 'preco',
      accessorFn: (i) => i.preco_unitario,
      header: 'Preço unit.',
      cell: ({ row }) =>
        row.original.preco_unitario ? (
          formatarMoeda(row.original.preco_unitario)
        ) : (
          <span className="text-xs text-muted-foreground">R$ 0,00</span>
        ),
      size: 120,
      meta: {
        headerTitle: 'Preço unitário',
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
    {
      id: 'total',
      accessorFn: (i) => totalItem(i),
      header: 'Total',
      cell: ({ row }) => formatarMoeda(totalItem(row.original)),
      size: 120,
      meta: {
        headerTitle: 'Total',
        headerClassName: 'text-end [&>div]:justify-end',
        cellClassName: 'text-end tabular-nums font-medium',
      },
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remover ${nomeServico(row.original)}`}
          onClick={() => onChange(itens.filter((i) => i.chave !== row.original.chave))}
        >
          <Trash2Icon />
        </Button>
      ),
      size: 44,
      enableSorting: false,
      meta: { cellClassName: 'text-end' },
    },
  ]

  const table = useTable({
    features: dataGridFeatures,
    columns: colunas,
    data: itens,
    getRowId: (i: ItemOrcamento) => i.chave,
  })

  const rodape =
    itens.length > 0 ? (
      <DataGridTableFootRow>
        <DataGridTableFootRowCell colSpan={4} className="text-muted-foreground">
          Subtotal da área
        </DataGridTableFootRowCell>
        <DataGridTableFootRowCell className="text-end font-semibold tabular-nums">
          {formatarMoeda(totalArea({ chave: '', nome: '', observacao: null, itens }))}
        </DataGridTableFootRowCell>
        <DataGridTableFootRowCell />
      </DataGridTableFootRow>
    ) : undefined

  return (
    <DataGrid
      table={table}
      recordCount={itens.length}
      i18n={ROTULOS_GRID}
      onCellsChange={aoEditar}
      onRowCreate={onAdicionar}
      rowCreateLabel="Adicionar serviço"
      emptyMessage="Nenhum serviço nesta área."
      tableLayout={{
        dense: true,
        cellSelection: true,
        cellSelectionMode: 'single',
        cellEditMode: 'click',
        cellBorder: true,
      }}
      tableClassNames={{
        base: 'min-w-[640px]',
        edgeCell: 'first:ps-4 last:pe-4',
      }}
    >
      <DataGridContainer className="border-y">
        <DataGridScrollArea>
          <DataGridTable footerContent={rodape} />
        </DataGridScrollArea>
        <DataGridCellSelection />
      </DataGridContainer>
    </DataGrid>
  )
}
