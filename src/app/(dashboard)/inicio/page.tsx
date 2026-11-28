import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarCheckIcon,
  FunnelIcon,
  HourglassIcon,
  WalletIcon,
  WrenchIcon,
  FolderClockIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AgendaIndisponivel } from '@/components/agenda/agenda-indisponivel'
import { NovaTarefa } from '@/components/agenda/nova-tarefa'
import { PrevisaoTempo } from '@/components/inicio/previsao-tempo'
import { TarefaItem } from '@/components/agenda/tarefa-item'
import { VistaInicioToggle, type VistaInicio } from '@/components/inicio/vista-inicio'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { agoraMs, hojeISO } from '@/lib/crm'
import { diaDe, inicioDoDia, rotuloDia, rotuloDiaLongo, somarDias } from '@/lib/agenda'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { cn } from '@/lib/utils'
import {
  FASE_NEGOCIO_LABEL,
  TIPO_POS_VENDA_LABEL,
  type FaseNegocio,
  type MembroEquipe,
  type Projeto,
  type TarefaAgenda,
  type TipoPosVenda,
} from '@/types'
import { carregarSessao, idDaEmpresa } from '@/lib/acesso'

/** Negócio aberto sem mudar de fase há este tempo, e sem próximo passo, pede atenção. */
const DIAS_NEGOCIO_PARADO = 14

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(
      new Date()
    )
  )
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function Numero({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string
  valor: number | string
  detalhe: string
  alerta?: boolean
}) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          'truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl',
          alerta && 'text-destructive-foreground'
        )}
      >
        {valor}
      </span>
      <span className="truncate text-xs text-muted-foreground">{detalhe}</span>
    </FramePanel>
  )
}

type VarianteAlerta = 'destructive-light' | 'warning-light' | 'info-light' | 'primary-light'

/** Uma linha de "Pede atenção": algo a resolver, com link para onde resolver. */
type Alerta = {
  id: string
  href: string
  titulo: string
  detalhe: string
  selo: string
  variante: VarianteAlerta
}

type GrupoAlertas = { id: string; rotulo: string; icone: typeof WalletIcon; itens: Alerta[] }

type RecebimentoInicio = {
  id: string
  projeto_id: string
  descricao: string
  valor: number
  vencimento: string
  projetos: { nome: string; clientes: { nome: string } | null } | null
}

type PosVendaInicio = {
  id: string
  cliente_id: string
  projeto_id: string | null
  tipo: TipoPosVenda
  titulo: string
  vence_em: string | null
  status: string
  clientes: { nome: string } | null
}

type NegocioInicio = {
  id: string
  titulo: string
  fase: FaseNegocio
  fase_alterada_em: string
  clientes: { nome: string } | null
}

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista: vistaParam } = await searchParams
  const vista: VistaInicio = vistaParam === 'semana' ? 'semana' : 'hoje'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('id', await idDaEmpresa())
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  // Hoje: até o fim de hoje. Semana: hoje e os 6 dias seguintes.
  const hoje = hojeISO()
  const ultimoDia = vista === 'hoje' ? hoje : somarDias(hoje, 6)
  // Instante exato: o negócio entra assim que completa os 14 dias.
  const limiteParado = new Date(agoraMs() - DIAS_NEGOCIO_PARADO * 86_400_000).toISOString()
  // Valores (a receber, orçamento) só para quem vê o Financeiro.
  const sessao = await carregarSessao()
  const veValores = sessao.situacao === 'ok' && sessao.acesso.pode('financeiro')

  const [
    tarefasRes,
    { data: projetos },
    { data: equipe },
    { data: clientes },
    recebimentosRes,
    posVendaRes,
    negociosRes,
    diarioRes,
    passosRes,
  ] = await Promise.all([
    supabase
      .from('atividades')
      .select('*, equipe(nome), clientes(nome, telefone)')
      .eq('empresa_id', empresa.id)
      .lt('previsto_para', inicioDoDia(somarDias(ultimoDia, 1)))
      .is('concluida_em', null)
      .order('previsto_para'),
    supabase
      .from('projetos')
      .select('*, clientes(nome)')
      .eq('empresa_id', empresa.id)
      .neq('status', 'completo'),
    supabase.from('equipe').select('id, nome').eq('empresa_id', empresa.id).order('nome'),
    supabase.from('clientes').select('id, nome, responsavel_id').eq('empresa_id', empresa.id).order('nome'),
    veValores
      ? supabase
          .from('recebimentos')
          .select('id, projeto_id, descricao, valor, vencimento, projetos(nome, clientes(nome))')
          .eq('empresa_id', empresa.id)
          .is('recebido_em', null)
          .lte('vencimento', ultimoDia)
          .order('vencimento')
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('pos_venda')
      .select('id, cliente_id, projeto_id, tipo, titulo, vence_em, status, clientes(nome)')
      .eq('empresa_id', empresa.id)
      .neq('status', 'resolvido')
      .in('tipo', ['assistencia', 'pesquisa', 'avaliacao', 'revisao'])
      .order('vence_em', { nullsFirst: true }),
    supabase
      .from('negocios')
      .select('id, titulo, fase, fase_alterada_em, clientes(nome)')
      .eq('empresa_id', empresa.id)
      .not('fase', 'in', '(ganho,perdido)')
      .lt('fase_alterada_em', limiteParado)
      .order('fase_alterada_em'),
    supabase.from('diario_obra').select('projeto_id').eq('empresa_id', empresa.id).eq('data', hoje),
    // Próximos passos em aberto ligados a cada negócio.
    supabase
      .from('atividades')
      .select('negocio_id')
      .eq('empresa_id', empresa.id)
      .is('concluida_em', null)
      .not('previsto_para', 'is', null)
      .not('negocio_id', 'is', null),
  ])

  const agendaDisponivel = !tarefasRes.error
  const tarefas = agendaDisponivel ? ((tarefasRes.data as TarefaAgenda[]) ?? []) : []
  const atrasadas = tarefas.filter((t) => diaDe(t.previsto_para) < hoje)
  const noPeriodo = tarefas.filter((t) => diaDe(t.previsto_para) >= hoje)
  // Semana: tarefas agrupadas por dia, na ordem.
  const porDia = new Map<string, TarefaAgenda[]>()
  for (const t of noPeriodo) {
    const d = diaDe(t.previsto_para)
    porDia.set(d, [...(porDia.get(d) ?? []), t])
  }

  const obras = (projetos as Projeto[]) ?? []
  const obrasAtrasadas = obras
    .filter((p) => p.data_prazo && p.data_prazo.slice(0, 10) < hoje)
    .sort((a, b) => (a.data_prazo ?? '').localeCompare(b.data_prazo ?? ''))
  // Fila de espera: obras em planejamento, pela data prevista de início
  // (sem data vão para o fim, por ordem de cadastro).
  const fila = obras
    .filter((p) => p.status === 'planejamento')
    .sort((a, b) => {
      if (a.data_inicio && b.data_inicio) return a.data_inicio.localeCompare(b.data_inicio)
      if (a.data_inicio) return -1
      if (b.data_inicio) return 1
      return a.created_at.localeCompare(b.created_at)
    })

  // ---- Pede atenção ---------------------------------------------------------
  const recebimentos = recebimentosRes.error ? [] : ((recebimentosRes.data as unknown as RecebimentoInicio[]) ?? [])
  const vencidos = recebimentos.filter((r) => r.vencimento < hoje)
  const totalVencido = vencidos.reduce((s, r) => s + Number(r.valor), 0)
  const alertasDinheiro: Alerta[] = recebimentos.map((r) => {
    const atrasado = r.vencimento < hoje
    return {
      id: `rec-${r.id}`,
      href: `/projetos/${r.projeto_id}?aba=financeiro`,
      titulo: `${formatarMoeda(Number(r.valor))} · ${r.descricao}`,
      detalhe: [r.projetos?.clientes?.nome, r.projetos?.nome].filter(Boolean).join(' · '),
      selo: atrasado ? `Venceu ${formatarData(r.vencimento)}` : r.vencimento === hoje ? 'Vence hoje' : `Vence ${rotuloDia(r.vencimento)}`,
      variante: atrasado ? 'destructive-light' : 'warning-light',
    }
  })

  const obrasComDiario = new Set(((diarioRes.data as { projeto_id: string }[] | null) ?? []).map((d) => d.projeto_id))
  const semDiario = diarioRes.error ? [] : obras.filter((p) => p.status === 'em_execucao' && !obrasComDiario.has(p.id))
  const alertasObras: Alerta[] = [
    ...obrasAtrasadas.map<Alerta>((p) => ({
      id: `atr-${p.id}`,
      href: `/projetos/${p.id}`,
      titulo: p.nome,
      detalhe: `${p.clientes?.nome ?? 'Sem cliente'} · ${p.percentual_conclusao}% feito`,
      selo: `Prazo ${formatarData(p.data_prazo)}`,
      variante: 'destructive-light',
    })),
    // O diário é do dia: só aparece na visão de hoje.
    ...(vista === 'hoje'
      ? semDiario.map<Alerta>((p) => ({
          id: `dia-${p.id}`,
          href: `/projetos/${p.id}?aba=diario`,
          titulo: p.nome,
          detalhe: p.clientes?.nome ?? 'Sem cliente',
          selo: 'Sem diário hoje',
          variante: 'info-light',
        }))
      : []),
  ]

  const posVenda = posVendaRes.error ? [] : ((posVendaRes.data as unknown as PosVendaInicio[]) ?? [])
  const alertasClientes: Alerta[] = posVenda
    // Chamado de assistência aberto sempre aparece; o resto, quando vence no período.
    .filter((p) => p.tipo === 'assistencia' || (p.vence_em !== null && p.vence_em <= ultimoDia))
    .map((p) => {
      const atrasado = p.vence_em !== null && p.vence_em < hoje
      return {
        id: `pv-${p.id}`,
        href: p.projeto_id ? `/projetos/${p.projeto_id}?aba=pos-venda` : `/clientes/${p.cliente_id}`,
        titulo: p.titulo,
        detalhe: `${TIPO_POS_VENDA_LABEL[p.tipo]} · ${p.clientes?.nome ?? 'Cliente'}`,
        selo:
          p.tipo === 'assistencia' && !p.vence_em
            ? p.status === 'agendado'
              ? 'Agendado'
              : 'Chamado aberto'
            : atrasado
              ? `Venceu ${formatarData(p.vence_em)}`
              : p.vence_em === hoje
                ? 'Vence hoje'
                : `Vence ${rotuloDia(p.vence_em!)}`,
        variante: atrasado || p.tipo === 'assistencia' ? 'destructive-light' : 'warning-light',
      }
    })

  const negociosComPasso = new Set(
    passosRes.error ? [] : ((passosRes.data as { negocio_id: string }[] | null) ?? []).map((a) => a.negocio_id)
  )
  const negocios = negociosRes.error ? [] : ((negociosRes.data as unknown as NegocioInicio[]) ?? [])
  const alertasVendas: Alerta[] = negocios
    .filter((n) => !negociosComPasso.has(n.id))
    .map((n) => {
      const dias = Math.max(
        DIAS_NEGOCIO_PARADO,
        Math.floor((agoraMs() - Date.parse(n.fase_alterada_em)) / 86_400_000)
      )
      return {
        id: `neg-${n.id}`,
        href: `/funil/${n.id}`,
        titulo: n.titulo,
        detalhe: `${n.clientes?.nome ?? 'Cliente'} · ${FASE_NEGOCIO_LABEL[n.fase]} · sem próximo passo`,
        selo: `Parado há ${dias} dias`,
        variante: 'warning-light',
      }
    })

  const grupos: GrupoAlertas[] = [
    { id: 'dinheiro', rotulo: 'A receber', icone: WalletIcon, itens: alertasDinheiro },
    { id: 'obras', rotulo: 'Obras', icone: FolderClockIcon, itens: alertasObras },
    { id: 'clientes', rotulo: 'Pós-venda', icone: WrenchIcon, itens: alertasClientes },
    { id: 'vendas', rotulo: 'Negócios parados', icone: FunnelIcon, itens: alertasVendas },
  ].filter((g) => g.itens.length > 0)
  const totalAlertas = grupos.reduce((s, g) => s + g.itens.length, 0)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{saudacao()}</h1>
          <p className="text-muted-foreground text-sm first-letter:uppercase">{rotuloDiaLongo(hoje)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VistaInicioToggle vista={vista} />
          <NovaTarefa
            empresaId={empresa.id}
            equipe={(equipe as Pick<MembroEquipe, 'id' | 'nome'>[] | null) ?? []}
            hoje={hoje}
            clientes={clientes ?? []}
            disponivel={agendaDisponivel}
          />
        </div>
      </header>

      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Tarefas atrasadas"
          valor={atrasadas.length}
          detalhe="Passaram do dia"
          alerta={atrasadas.length > 0}
        />
        <Numero
          rotulo={vista === 'hoje' ? 'Para hoje' : 'Próximos 7 dias'}
          valor={noPeriodo.length}
          detalhe="Ligações, visitas e retornos"
        />
        {veValores ? (
          <Numero
            rotulo="A receber vencido"
            valor={formatarMoeda(totalVencido)}
            detalhe={vencidos.length === 1 ? '1 parcela' : `${vencidos.length} parcelas`}
            alerta={totalVencido > 0}
          />
        ) : (
          <Numero rotulo="Obras atrasadas" valor={obrasAtrasadas.length} detalhe="Prazo vencido" alerta={obrasAtrasadas.length > 0} />
        )}
        <Numero rotulo="Pedem atenção" valor={totalAlertas} detalhe="Cobranças, obras, chamados e negócios" />
      </Frame>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <Frame spacing="default" className="min-w-0 self-start">
          <FrameHeader className="flex flex-row items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Tarefas</FrameTitle>
              <FrameDescription>
                {vista === 'hoje' ? 'Atrasadas e de hoje' : 'Atrasadas e dos próximos 7 dias'}
              </FrameDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={vista === 'hoje' ? '/agenda' : '/agenda?modo=semana'} />}
            >
              Agenda
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-4">
            {!agendaDisponivel ? (
              <AgendaIndisponivel />
            ) : tarefas.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarCheckIcon />
                  </EmptyMedia>
                  <EmptyTitle>Tudo em dia</EmptyTitle>
                  <EmptyDescription>
                    {vista === 'hoje' ? 'Nenhuma tarefa atrasada ou para hoje.' : 'Nenhuma tarefa nos próximos 7 dias.'}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {atrasadas.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-xs font-medium text-destructive-foreground">Atrasadas</h2>
                    <ItemGroup className="gap-2">
                      {atrasadas.map((t) => (
                        <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente mostrarDia />
                      ))}
                    </ItemGroup>
                  </section>
                )}
                {[...porDia.entries()].map(([dia, lista]) => (
                  <section key={dia} className="flex flex-col gap-2">
                    <h2 className="text-xs font-medium text-muted-foreground first-letter:uppercase">
                      {dia === hoje ? 'Hoje' : dia === somarDias(hoje, 1) ? 'Amanhã' : rotuloDia(dia)}
                    </h2>
                    <ItemGroup className="gap-2">
                      {lista.map((t) => (
                        <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente />
                      ))}
                    </ItemGroup>
                  </section>
                ))}
              </>
            )}
          </FramePanel>
        </Frame>

        <div className="flex min-w-0 flex-col gap-6 self-start">
          <PrevisaoTempo empresaId={empresa.id} />
          <Frame spacing="default" className="min-w-0">
            <FrameHeader>
              <FrameTitle>Pede atenção</FrameTitle>
              <FrameDescription>
                {vista === 'hoje' ? 'O que está atrasado ou vence hoje' : 'O que está atrasado ou vence em 7 dias'}
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {grupos.length === 0 ? (
                <Empty className="p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BadgeCheckIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nada pendente</EmptyTitle>
                    <EmptyDescription>Cobranças, obras, chamados e negócios em dia.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                grupos.map((g) => (
                  <section key={g.id} className="flex flex-col gap-1">
                    <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
                      <g.icone aria-hidden />
                      {g.rotulo}
                    </h2>
                    <ItemGroup className="gap-1">
                      {g.itens.map((a) => (
                        <Item key={a.id} size="sm" render={<Link href={a.href} />}>
                          <ItemContent className="min-w-0">
                            <ItemTitle className="w-full min-w-0">
                              <span className="truncate">{a.titulo}</span>
                            </ItemTitle>
                            <ItemDescription className="truncate text-xs">{a.detalhe}</ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <Badge variant={a.variante}>{a.selo}</Badge>
                          </ItemActions>
                        </Item>
                      ))}
                    </ItemGroup>
                  </section>
                ))
              )}
            </FramePanel>
          </Frame>

          <Frame spacing="default" className="min-w-0">
            <FrameHeader>
              <FrameTitle>Fila de espera</FrameTitle>
              <FrameDescription>Obras em planejamento, pela data de início</FrameDescription>
            </FrameHeader>
            <FramePanel>
              {fila.length === 0 ? (
                <Empty className="p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HourglassIcon />
                    </EmptyMedia>
                    <EmptyTitle>Fila vazia</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ItemGroup className="gap-1">
                  {fila.map((p, i) => (
                    <Item key={p.id} size="sm" render={<Link href={`/projetos/${p.id}`} />}>
                      <ItemMedia>
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                          {i + 1}
                        </span>
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="w-full min-w-0">
                          <span className="truncate">{p.nome}</span>
                        </ItemTitle>
                        <ItemDescription className="truncate text-xs tabular-nums">
                          {p.clientes?.nome ?? 'Sem cliente'}
                          {veValores && p.orcamento_total ? ` · ${formatarMoeda(p.orcamento_total)}` : ''}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions className="text-xs text-muted-foreground tabular-nums">
                        {p.data_inicio ? `Início ${formatarData(p.data_inicio)}` : 'Sem data'}
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </FramePanel>
          </Frame>
        </div>
      </div>
    </div>
  )
}
