'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { CircleCheckIcon, TrendingUpIcon, WalletIcon } from 'lucide-react'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { mesDe, resumoRecebimentos, situacaoRecebimento } from '@/lib/financeiro'
import { VARIANTE_STATUS_PROJETO } from '@/lib/status'
import { STATUS_PROJETO_LABEL, type Recebimento, type StatusProjeto } from '@/types'
import { Badge } from '@/components/reui/badge'
import { DataGrid, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROTULOS_GRID } from '@/lib/rotulos-tabela'
import { iniciais } from '@/lib/formato'
import { Numero } from './numero'
import { RecebimentosTabela } from './recebimentos-tabela'

export type ObraMargem = {
  id: string
  nome: string
  status: StatusProjeto
  clienteId: string
  clienteNome: string
  orcamento: number
  compras: number
}

type LinhaMargem = ObraMargem & { recebido: number; aReceber: number; margem: number }

type Props = {
  recebimentos: Recebimento[]
  disponivel: boolean
  obras: ObraMargem[]
  hoje: string
}

function Vazio({ icone: Icone, titulo, texto }: { icone: typeof WalletIcon; titulo: string; texto: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icone />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>{texto}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

const ABAS_FINANCEIRO = ['receber', 'atrasados', 'mes', 'margem'] as const
type AbaFinanceiro = (typeof ABAS_FINANCEIRO)[number]

// Tela Financeiro: a receber, atrasados por cliente, recebido no mês e
// margem por obra (recebido menos compras).
export function FinanceiroPainel({ recebimentos: iniciaisLista, disponivel, obras, hoje }: Props) {
  // A aba vem da URL (?aba=), para o menu lateral abrir direto nela.
  const router = useRouter()
  const abaUrl = useSearchParams().get('aba') ?? ''
  const [recebimentos, setRecebimentos] = useState(iniciaisLista)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'aReceber', desc: true }])
  const { inicio, fim } = mesDe(hoje)

  const resumo = resumoRecebimentos(recebimentos, hoje)
  const pendentes = recebimentos.filter((r) => !r.recebido_em)
  const doMes = recebimentos
    .filter((r) => r.recebido_em && r.recebido_em >= inicio && r.recebido_em < fim)
    .sort((a, b) => (b.recebido_em ?? '').localeCompare(a.recebido_em ?? ''))
  const recebidoMes = doMes.reduce((s, r) => s + Number(r.valor), 0)
  const venceNoMes = pendentes
    .filter((r) => r.vencimento >= hoje && r.vencimento < fim)
    .reduce((s, r) => s + Number(r.valor), 0)

  // Atrasados agrupados por cliente, do maior valor para o menor.
  const atrasadosPorCliente = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; valor: number; parcelas: number; maisAntigo: string }>()
    for (const r of recebimentos) {
      if (situacaoRecebimento(r, hoje) !== 'atrasado' || !r.projetos) continue
      const id = r.projetos.cliente_id
      const atual = mapa.get(id) ?? {
        id,
        nome: r.projetos.clientes?.nome ?? '—',
        valor: 0,
        parcelas: 0,
        maisAntigo: r.vencimento,
      }
      atual.valor += Number(r.valor)
      atual.parcelas += 1
      if (r.vencimento < atual.maisAntigo) atual.maisAntigo = r.vencimento
      mapa.set(id, atual)
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor)
  }, [recebimentos, hoje])

  const linhasMargem = useMemo<LinhaMargem[]>(() => {
    const porObra = new Map<string, { recebido: number; aReceber: number }>()
    for (const r of recebimentos) {
      const a = porObra.get(r.projeto_id) ?? { recebido: 0, aReceber: 0 }
      if (r.recebido_em) a.recebido += Number(r.valor)
      else a.aReceber += Number(r.valor)
      porObra.set(r.projeto_id, a)
    }
    return obras
      .filter((o) => porObra.has(o.id) || o.compras > 0)
      .map((o) => {
        const a = porObra.get(o.id) ?? { recebido: 0, aReceber: 0 }
        return { ...o, ...a, margem: a.recebido - o.compras }
      })
  }, [obras, recebimentos])

  const margemTotal = linhasMargem.reduce((s, l) => s + l.margem, 0)

  const colunasMargem = useMemo<ColumnDef<DataGridFeatures, LinhaMargem>[]>(
    () => [
      {
        accessorKey: 'nome',
        id: 'nome',
        header: ({ column }) => <DataGridColumnHeader title="Obra" column={column} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link href={`/projetos/${row.original.id}`} className="truncate font-medium text-foreground hover:underline">
              {row.original.nome}
            </Link>
            <span className="truncate text-xs text-muted-foreground">{row.original.clienteNome}</span>
          </div>
        ),
        size: 240,
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
      },
      ...(
        [
          ['orcamento', 'Orçamento'],
          ['recebido', 'Recebido'],
          ['aReceber', 'A receber'],
          ['compras', 'Compras'],
        ] as const
      ).map(
        ([id, titulo]): ColumnDef<DataGridFeatures, LinhaMargem> => ({
          accessorKey: id,
          id,
          header: ({ column }) => <DataGridColumnHeader title={titulo} column={column} />,
          cell: ({ row }) => formatarMoeda(row.original[id]),
          size: 130,
          meta: {
            headerClassName: 'text-end [&>div]:justify-end',
            cellClassName: 'text-end tabular-nums',
          },
        })
      ),
      {
        accessorKey: 'margem',
        id: 'margem',
        header: ({ column }) => <DataGridColumnHeader title="Margem" column={column} />,
        cell: ({ row }) => (
          <span className={row.original.margem < 0 ? 'text-destructive' : ''}>
            {formatarMoeda(row.original.margem)}
          </span>
        ),
        size: 130,
        meta: {
          headerClassName: 'text-end [&>div]:justify-end',
          cellClassName: 'text-end tabular-nums font-medium',
        },
      },
    ],
    []
  )

  const tabelaMargem = useTable({
    features: dataGridFeatures,
    columns: colunasMargem,
    data: linhasMargem,
    getRowId: (l: LinhaMargem) => l.id,
    state: { sorting },
    onSortingChange: setSorting,
  })

  const abaAtual = ABAS_FINANCEIRO.includes(abaUrl as AbaFinanceiro)
    ? abaUrl
    : atrasadosPorCliente.length > 0
      ? 'atrasados'
      : 'receber'
  // Sem aba na URL, grava a escolhida para o menu lateral marcar a certa.
  useEffect(() => {
    if (disponivel && abaUrl !== abaAtual) router.replace(`/financeiro?aba=${abaAtual}`, { scroll: false })
  }, [disponivel, abaUrl, abaAtual, router])

  if (!disponivel) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Frame spacing="default">
          <Vazio
            icone={WalletIcon}
            titulo="Financeiro ainda não ativado"
            texto="Falta rodar o SQL do financeiro no Supabase (supabase/migracoes/2026-11-27-financeiro.sql)."
          />
        </Frame>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Parcelas a receber dos clientes e margem das obras.</p>
      </header>

      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="A receber"
          valor={formatarMoeda(resumo.aReceber)}
          detalhe={`${formatarMoeda(venceNoMes)} vence até o fim do mês`}
        />
        <Numero
          rotulo="Atrasado"
          valor={formatarMoeda(resumo.atrasado)}
          detalhe={
            resumo.parcelasAtrasadas > 0
              ? `${resumo.parcelasAtrasadas} ${resumo.parcelasAtrasadas === 1 ? 'parcela' : 'parcelas'} de ${atrasadosPorCliente.length} ${atrasadosPorCliente.length === 1 ? 'cliente' : 'clientes'}`
              : 'Nada atrasado'
          }
          alerta={resumo.atrasado > 0}
        />
        <Numero
          rotulo="Recebido no mês"
          valor={formatarMoeda(recebidoMes)}
          detalhe={`${doMes.length} ${doMes.length === 1 ? 'parcela' : 'parcelas'}`}
        />
        <Numero
          rotulo="Margem das obras"
          valor={formatarMoeda(margemTotal)}
          detalhe="Recebido menos compras"
          alerta={margemTotal < 0}
        />
      </Frame>

      <Tabs
        value={abaAtual}
        onValueChange={(v) => router.replace(`/financeiro?aba=${v}`, { scroll: false })}
        className="gap-4"
      >
        <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line">
            <TabsTrigger value="receber">
              A receber
              <span className="text-xs text-muted-foreground tabular-nums">{pendentes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="atrasados">
              Atrasados
              {atrasadosPorCliente.length > 0 && (
                <span className="text-xs text-destructive tabular-nums">{atrasadosPorCliente.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mes">Recebido no mês</TabsTrigger>
            <TabsTrigger value="margem">Margem por obra</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="receber">
          <RecebimentosTabela
            recebimentos={pendentes}
            onChange={(lista) => {
              const porId = new Map(lista.map((r) => [r.id, r]))
              setRecebimentos((todos) =>
                todos.flatMap((r) => (r.recebido_em ? [r] : porId.has(r.id) ? [porId.get(r.id)!] : []))
              )
            }}
            hoje={hoje}
            mostrarCliente
            mostrarObra
            tamanhoPagina={25}
            vazio={
              <Vazio
                icone={CircleCheckIcon}
                titulo="Nada a receber"
                texto="Monte o plano de pagamento na aba Financeiro de cada obra."
              />
            }
          >
            <FrameHeader>
              <FrameTitle>Parcelas em aberto</FrameTitle>
              <FrameDescription className="tabular-nums">
                {formatarMoeda(resumo.aReceber)} no total, ordenado por vencimento
              </FrameDescription>
            </FrameHeader>
          </RecebimentosTabela>
        </TabsContent>

        <TabsContent value="atrasados">
          <Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Atrasados por cliente</FrameTitle>
              <FrameDescription>Quem cobrar primeiro, do maior valor para o menor</FrameDescription>
            </FrameHeader>
            <FramePanel>
              {atrasadosPorCliente.length === 0 ? (
                <Vazio icone={CircleCheckIcon} titulo="Nenhum atraso" texto="Todos os clientes estão em dia." />
              ) : (
                <ItemGroup>
                  {atrasadosPorCliente.map((c) => (
                    <Item key={c.id} render={<Link href={`/clientes/${c.id}`} />}>
                      <ItemMedia>
                        <Avatar>
                          <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="truncate">{c.nome}</ItemTitle>
                        <ItemDescription className="text-xs tabular-nums">
                          {c.parcelas} {c.parcelas === 1 ? 'parcela' : 'parcelas'} · mais antiga venceu{' '}
                          {formatarData(c.maisAntigo)}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <span className="font-semibold text-destructive tabular-nums">{formatarMoeda(c.valor)}</span>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </FramePanel>
          </Frame>
        </TabsContent>

        <TabsContent value="mes">
          <RecebimentosTabela
            recebimentos={doMes}
            onChange={(lista) => {
              const porId = new Map(lista.map((r) => [r.id, r]))
              const idsMes = new Set(doMes.map((r) => r.id))
              setRecebimentos((todos) =>
                todos.flatMap((r) => (!idsMes.has(r.id) ? [r] : porId.has(r.id) ? [porId.get(r.id)!] : []))
              )
            }}
            hoje={hoje}
            mostrarCliente
            mostrarObra
            tamanhoPagina={25}
            vazio={<Vazio icone={WalletIcon} titulo="Nada recebido este mês" texto="As baixas do mês aparecem aqui." />}
          >
            <FrameHeader>
              <FrameTitle>Recebido no mês</FrameTitle>
              <FrameDescription className="tabular-nums">
                {formatarMoeda(recebidoMes)} desde {formatarData(inicio)}
              </FrameDescription>
            </FrameHeader>
          </RecebimentosTabela>
        </TabsContent>

        <TabsContent value="margem">
          <DataGrid
            table={tabelaMargem}
            recordCount={linhasMargem.length}
            i18n={ROTULOS_GRID}
            tableClassNames={{ base: 'min-w-[900px]' }}
            emptyMessage={
              <Vazio
                icone={TrendingUpIcon}
                titulo="Sem dados de margem"
                texto="A margem aparece quando a obra tem parcelas ou compras."
              />
            }
          >
            <Frame spacing="sm" stacked dense>
              <FrameHeader>
                <FrameTitle>Margem por obra</FrameTitle>
                <FrameDescription>Recebido até agora menos as compras lançadas</FrameDescription>
              </FrameHeader>
              <FramePanel className="p-0">
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </FramePanel>
            </Frame>
          </DataGrid>
        </TabsContent>
      </Tabs>
    </div>
  )
}
