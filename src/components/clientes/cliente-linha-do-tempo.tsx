import Link from 'next/link'
import { FolderKanbanIcon, HistoryIcon, UserPlusIcon } from 'lucide-react'
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/reui/timeline'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { formatarDataHora } from '@/lib/formato'
import type { TipoAtividade } from '@/types'
import { ICONE_ATIVIDADE } from './icones-atividade'

export type EventoCliente = {
  id: string
  quando: string
  titulo: string
  texto?: string
  tipo: TipoAtividade | 'cadastro' | 'obra'
  href?: string
}

function Icone({ tipo }: { tipo: EventoCliente['tipo'] }) {
  const Comp =
    tipo === 'cadastro'
      ? UserPlusIcon
      : tipo === 'obra'
        ? FolderKanbanIcon
        : // Tipos novos do banco (tarefa, sistema) antes de o app ter ícone: não derruba a tela.
          (ICONE_ATIVIDADE[tipo] ?? HistoryIcon)
  return <Comp className="size-3" />
}

// Linha do tempo única do cliente: contatos registrados, obras e cadastro.
export function ClienteLinhaDoTempo({ eventos }: { eventos: EventoCliente[] }) {
  if (eventos.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Nada registrado ainda</EmptyTitle>
          <EmptyDescription>Registre o primeiro contato com este cliente.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Timeline defaultValue={0}>
      {eventos.map((e, i) => (
        <TimelineItem key={e.id} step={i + 1}>
          <TimelineHeader>
            <TimelineSeparator />
            <TimelineDate dateTime={e.quando}>{formatarDataHora(e.quando)}</TimelineDate>
            <TimelineTitle>
              {e.href ? (
                <Link href={e.href} className="hover:underline">
                  {e.titulo}
                </Link>
              ) : (
                e.titulo
              )}
            </TimelineTitle>
            <TimelineIndicator className="flex items-center justify-center border-none bg-primary/10 text-primary size-6">
              <Icone tipo={e.tipo} />
            </TimelineIndicator>
          </TimelineHeader>
          {e.texto && <TimelineContent className="whitespace-pre-line">{e.texto}</TimelineContent>}
        </TimelineItem>
      ))}
    </Timeline>
  )
}
