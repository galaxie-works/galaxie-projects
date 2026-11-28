import { DatabaseIcon } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// Mostrado enquanto o SQL da agenda (supabase/migracoes/2026-11-27-agenda.sql)
// ainda não rodou no Supabase.
export function AgendaIndisponivel() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>
        <EmptyTitle>Agenda ainda não ativada</EmptyTitle>
        <EmptyDescription>
          Agenda indisponível no momento. Tente de novo mais tarde.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
