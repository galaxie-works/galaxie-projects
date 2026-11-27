import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRightIcon, CalendarCheckIcon, FolderClockIcon, HourglassIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AgendaIndisponivel } from '@/components/agenda/agenda-indisponivel'
import { NovaTarefa } from '@/components/agenda/nova-tarefa'
import { TarefaItem } from '@/components/agenda/tarefa-item'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { hojeISO } from '@/lib/crm'
import { diaDe, inicioDoDia, rotuloDiaLongo, somarDias } from '@/lib/agenda'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { cn } from '@/lib/utils'
import type { MembroEquipe, Projeto, TarefaAgenda } from '@/types'

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

function Numero({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: number; detalhe: string; alerta?: boolean }) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          'text-lg font-semibold tracking-tight tabular-nums sm:text-xl',
          alerta && valor > 0 && 'text-destructive-foreground'
        )}
      >
        {valor}
      </span>
      <span className="text-xs text-muted-foreground">{detalhe}</span>
    </FramePanel>
  )
}

export default async function InicioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const hoje = hojeISO()
  const [tarefasRes, { data: projetos }, { data: equipe }, { data: clientes }] = await Promise.all([
    supabase
      .from('atividades')
      .select('*, equipe(nome), clientes(nome, telefone)')
      .eq('empresa_id', empresa.id)
      .lt('previsto_para', inicioDoDia(somarDias(hoje, 1)))
      .is('concluida_em', null)
      .order('previsto_para'),
    supabase
      .from('projetos')
      .select('*, clientes(nome)')
      .eq('empresa_id', empresa.id)
      .neq('status', 'completo'),
    supabase.from('equipe').select('id, nome').eq('empresa_id', empresa.id).order('nome'),
    supabase.from('clientes').select('id, nome, responsavel_id').eq('empresa_id', empresa.id).order('nome'),
  ])

  const agendaDisponivel = !tarefasRes.error
  const tarefas = agendaDisponivel ? ((tarefasRes.data as TarefaAgenda[]) ?? []) : []
  const atrasadas = tarefas.filter((t) => diaDe(t.previsto_para) < hoje)
  const deHoje = tarefas.filter((t) => diaDe(t.previsto_para) === hoje)

  const obras = (projetos as Projeto[]) ?? []
  const obrasAtrasadas = obras
    .filter((p) => p.data_prazo && p.data_prazo.slice(0, 10) < hoje)
    .sort((a, b) => (a.data_prazo ?? '').localeCompare(b.data_prazo ?? ''))
  // Fila de espera: obras em planejamento, pela data prevista de início
  // (sem data vão para o fim, por ordem de cadastro). Quando o funil de
  // negócios existir, contratos assinados entram aqui também.
  const fila = obras
    .filter((p) => p.status === 'planejamento')
    .sort((a, b) => {
      if (a.data_inicio && b.data_inicio) return a.data_inicio.localeCompare(b.data_inicio)
      if (a.data_inicio) return -1
      if (b.data_inicio) return 1
      return a.created_at.localeCompare(b.created_at)
    })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{saudacao()}</h1>
          <p className="text-muted-foreground text-sm first-letter:uppercase">{rotuloDiaLongo(hoje)}</p>
        </div>
        <NovaTarefa
          empresaId={empresa.id}
          equipe={(equipe as Pick<MembroEquipe, 'id' | 'nome'>[] | null) ?? []}
          hoje={hoje}
          clientes={clientes ?? []}
          disponivel={agendaDisponivel}
        />
      </header>

      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Follow-ups atrasados" valor={atrasadas.length} detalhe="Passaram do dia" alerta />
        <Numero rotulo="Para hoje" valor={deHoje.length} detalhe="Ligações, visitas e retornos" />
        <Numero rotulo="Obras atrasadas" valor={obrasAtrasadas.length} detalhe="Prazo vencido" alerta />
        <Numero rotulo="Fila de espera" valor={fila.length} detalhe="Obras aguardando início" />
      </Frame>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Frame spacing="default" className="min-w-0 self-start">
          <FrameHeader className="flex flex-row items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Follow-ups</FrameTitle>
              <FrameDescription>Atrasados e de hoje</FrameDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/agenda" />}>
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
                  <EmptyDescription>Nenhum follow-up atrasado ou para hoje.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {atrasadas.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-xs font-medium text-destructive-foreground">Atrasados</h2>
                    <ItemGroup className="gap-2">
                      {atrasadas.map((t) => (
                        <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente mostrarDia />
                      ))}
                    </ItemGroup>
                  </section>
                )}
                {deHoje.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-xs font-medium text-muted-foreground">Hoje</h2>
                    <ItemGroup className="gap-2">
                      {deHoje.map((t) => (
                        <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente />
                      ))}
                    </ItemGroup>
                  </section>
                )}
              </>
            )}
          </FramePanel>
        </Frame>

        <div className="flex min-w-0 flex-col gap-6 self-start">
          <Frame spacing="default" className="min-w-0">
            <FrameHeader>
              <FrameTitle>Obras atrasadas</FrameTitle>
              <FrameDescription>Prazo de entrega vencido</FrameDescription>
            </FrameHeader>
            <FramePanel>
              {obrasAtrasadas.length === 0 ? (
                <Empty className="p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FolderClockIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma obra atrasada</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ItemGroup className="gap-1">
                  {obrasAtrasadas.map((p) => (
                    <Item key={p.id} size="sm" render={<Link href={`/projetos/${p.id}`} />}>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="w-full min-w-0">
                          <span className="truncate">{p.nome}</span>
                        </ItemTitle>
                        <ItemDescription className="truncate text-xs">
                          {p.clientes?.nome ?? 'Sem cliente'} · {p.percentual_conclusao}% feito
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Badge variant="destructive-light">Prazo {formatarData(p.data_prazo)}</Badge>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
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
                          {p.orcamento_total ? ` · ${formatarMoeda(p.orcamento_total)}` : ''}
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
