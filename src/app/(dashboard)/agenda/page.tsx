import { redirect } from 'next/navigation'
import { CalendarDaysIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  AgendaControles,
  SEM_RESPONSAVEL_FILTRO,
  TODOS,
  type ModoAgenda,
} from '@/components/agenda/agenda-controles'
import { AgendaIndisponivel } from '@/components/agenda/agenda-indisponivel'
import { NovaTarefa } from '@/components/agenda/nova-tarefa'
import { TarefaItem } from '@/components/agenda/tarefa-item'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { hojeISO } from '@/lib/crm'
import {
  diaDe,
  diaValido,
  inicioDaSemana,
  inicioDoDia,
  rotuloDia,
  rotuloDiaLongo,
  somarDias,
} from '@/lib/agenda'
import type { MembroEquipe, TarefaAgenda } from '@/types'

const SELECAO = '*, equipe(nome), clientes(nome, telefone)'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; modo?: string; resp?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const hoje = hojeISO()
  const dia = diaValido(params.dia) ? params.dia : hoje
  const modo: ModoAgenda = params.modo === 'semana' ? 'semana' : 'dia'
  const responsavel = params.resp ?? TODOS

  const inicio = modo === 'dia' ? dia : inicioDaSemana(dia)
  const dias = Array.from({ length: modo === 'dia' ? 1 : 7 }, (_, i) => somarDias(inicio, i))
  const fim = somarDias(inicio, dias.length)

  let periodoQ = supabase
    .from('atividades')
    .select(SELECAO)
    .eq('empresa_id', empresa.id)
    .gte('previsto_para', inicioDoDia(inicio))
    .lt('previsto_para', inicioDoDia(fim))
  let atrasadasQ = supabase
    .from('atividades')
    .select(SELECAO)
    .eq('empresa_id', empresa.id)
    .lt('previsto_para', inicioDoDia(hoje))
    .is('concluida_em', null)
  if (responsavel === SEM_RESPONSAVEL_FILTRO) {
    periodoQ = periodoQ.is('responsavel_id', null)
    atrasadasQ = atrasadasQ.is('responsavel_id', null)
  } else if (responsavel !== TODOS) {
    periodoQ = periodoQ.eq('responsavel_id', responsavel)
    atrasadasQ = atrasadasQ.eq('responsavel_id', responsavel)
  }

  const [periodoRes, atrasadasRes, { data: equipe }, { data: clientes }] = await Promise.all([
    periodoQ.order('previsto_para'),
    atrasadasQ.order('previsto_para'),
    supabase.from('equipe').select('id, nome').eq('empresa_id', empresa.id).order('nome'),
    supabase.from('clientes').select('id, nome, responsavel_id').eq('empresa_id', empresa.id).order('nome'),
  ])

  const disponivel = !periodoRes.error && !atrasadasRes.error
  const periodo = disponivel ? ((periodoRes.data as TarefaAgenda[]) ?? []) : []
  // Atrasadas aparecem no topo quando a visão chega a hoje ou ao futuro
  // (as que já caem dentro do período ficam no seu dia).
  const atrasadas =
    disponivel && fim > hoje
      ? ((atrasadasRes.data as TarefaAgenda[]) ?? []).filter((t) => diaDe(t.previsto_para) < inicio)
      : []
  const listaEquipe = (equipe as Pick<MembroEquipe, 'id' | 'nome'>[] | null) ?? []

  const porDia = new Map<string, TarefaAgenda[]>(dias.map((d) => [d, []]))
  for (const t of periodo) porDia.get(diaDe(t.previsto_para))?.push(t)
  const abertas = periodo.filter((t) => !t.concluida_em).length

  const titulo =
    modo === 'dia'
      ? dia === hoje
        ? 'Hoje'
        : rotuloDiaLongo(dia)
      : `${rotuloDia(inicio)} a ${rotuloDia(somarDias(fim, -1))}`

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm">Ligações, visitas e retornos combinados com clientes.</p>
        </div>
        <NovaTarefa
          empresaId={empresa.id}
          equipe={listaEquipe}
          hoje={hoje}
          clientes={clientes ?? []}
          dia={dia}
          disponivel={disponivel}
        />
      </header>

      <AgendaControles dia={dia} modo={modo} responsavel={responsavel} hoje={hoje} equipe={listaEquipe} />

      {!disponivel ? (
        <Frame spacing="default">
          <FramePanel>
            <AgendaIndisponivel />
          </FramePanel>
        </Frame>
      ) : (
        <div className="flex flex-col gap-6">
          {atrasadas.length > 0 && (
            <Frame spacing="default" className="min-w-0">
              <FrameHeader>
                <FrameTitle className="text-destructive">Atrasadas</FrameTitle>
                <FrameDescription>
                  {atrasadas.length === 1 ? '1 tarefa passou do dia' : `${atrasadas.length} tarefas passaram do dia`}
                </FrameDescription>
              </FrameHeader>
              <FramePanel>
                <ItemGroup className="gap-2">
                  {atrasadas.map((t) => (
                    <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente mostrarDia />
                  ))}
                </ItemGroup>
              </FramePanel>
            </Frame>
          )}

          <Frame spacing="default" className="min-w-0">
            <FrameHeader>
              <FrameTitle className="first-letter:uppercase">{titulo}</FrameTitle>
              <FrameDescription>
                {abertas === 0 ? 'Nenhuma tarefa aberta' : abertas === 1 ? '1 tarefa aberta' : `${abertas} tarefas abertas`}
              </FrameDescription>
            </FrameHeader>
            {modo === 'dia' ? (
              <FramePanel>
                <ListaDoDia tarefas={porDia.get(dia) ?? []} hoje={hoje} />
              </FramePanel>
            ) : (
              dias.map((d) => {
                const tarefas = porDia.get(d) ?? []
                return (
                  <FramePanel key={d} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium first-letter:uppercase">{rotuloDia(d)}</h2>
                      {d === hoje && <Badge variant="primary-light">Hoje</Badge>}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {tarefas.length > 0 ? tarefas.length : ''}
                      </span>
                    </div>
                    {tarefas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Livre</p>
                    ) : (
                      <ItemGroup className="gap-2">
                        {tarefas.map((t) => (
                          <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente />
                        ))}
                      </ItemGroup>
                    )}
                  </FramePanel>
                )
              })
            )}
          </Frame>
        </div>
      )}
    </div>
  )
}

function ListaDoDia({ tarefas, hoje }: { tarefas: TarefaAgenda[]; hoje: string }) {
  if (tarefas.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDaysIcon />
          </EmptyMedia>
          <EmptyTitle>Dia livre</EmptyTitle>
          <EmptyDescription>Nenhuma ligação, visita ou retorno marcado.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <ItemGroup className="gap-2">
      {tarefas.map((t) => (
        <TarefaItem key={t.id} tarefa={t} hoje={hoje} mostrarCliente />
      ))}
    </ItemGroup>
  )
}
