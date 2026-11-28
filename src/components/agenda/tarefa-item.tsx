'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClockIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ICONE_ATIVIDADE } from '@/components/clientes/icones-atividade'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { diaDe, horaDe, montarPrevisto, rotuloDia, situacaoTarefa, somarDias } from '@/lib/agenda'
import { TIPO_ATIVIDADE_LABEL, type TarefaAgenda } from '@/types'

type Props = {
  tarefa: TarefaAgenda
  hoje: string
  /** Mostra o nome do cliente (Agenda e Início). No painel do cliente, não. */
  mostrarCliente?: boolean
  /** Mostra o dia junto da hora (listas que misturam dias). */
  mostrarDia?: boolean
}

// Uma tarefa / próximo passo: marcar como feita (com resultado), adiar ou excluir.
export function TarefaItem({ tarefa: t, hoje, mostrarCliente, mostrarDia }: Props) {
  const router = useRouter()
  const [concluindo, setConcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const situacao = situacaoTarefa(t, hoje)
  const Icone = ICONE_ATIVIDADE[t.tipo]
  const dia = diaDe(t.previsto_para)
  const quando = `${mostrarDia || situacao === 'atrasada' ? `${rotuloDia(dia)} · ` : ''}${horaDe(t.previsto_para)}`

  async function atualizar(campos: Record<string, unknown>, mensagem: string) {
    setOcupado(true)
    const { error } = await createClient().from('atividades').update(campos).eq('id', t.id)
    setOcupado(false)
    if (error) {
      toast.error('Não foi possível salvar', { description: error.message })
      return false
    }
    toast.success(mensagem)
    router.refresh()
    return true
  }

  async function reabrir() {
    await atualizar({ concluida_em: null, resultado: null }, 'Tarefa reaberta')
  }

  async function adiar(dias: number) {
    // Adia a partir de hoje se já estava atrasada; senão, a partir do dia marcado.
    const base = dia < hoje ? hoje : dia
    await atualizar(
      { previsto_para: montarPrevisto(somarDias(base, dias), horaDe(t.previsto_para)) },
      dias === 1 ? 'Adiada para o dia seguinte' : `Adiada ${dias} dias`
    )
  }

  async function excluir() {
    setOcupado(true)
    const { error } = await createClient().from('atividades').delete().eq('id', t.id)
    setOcupado(false)
    if (error) {
      toast.error('Não foi possível excluir', { description: error.message })
      return
    }
    toast.success('Tarefa excluída')
    router.refresh()
  }

  return (
    <>
      <Item variant="outline" size="sm" className={cn(situacao === 'atrasada' && 'border-destructive-foreground/40')}>
        <ItemMedia className="self-start pt-0.5">
          <Checkbox
            checked={situacao === 'concluida'}
            disabled={ocupado}
            onCheckedChange={(marcado) => (marcado ? setConcluindo(true) : reabrir())}
            aria-label={situacao === 'concluida' ? 'Reabrir tarefa' : 'Marcar como feita'}
          />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle
            className={cn(
              'w-full min-w-0',
              situacao === 'concluida' && 'text-muted-foreground line-through'
            )}
          >
            <Icone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{t.texto}</span>
          </ItemTitle>
          <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
            <span className={cn(situacao === 'atrasada' && 'font-medium text-destructive-foreground')}>{quando}</span>
            {mostrarCliente && t.clientes?.nome && (
              <>
                <span aria-hidden className="bg-muted-foreground/40 size-1 shrink-0 rounded-full" />
                <Link href={`/clientes/${t.cliente_id}`} className="truncate hover:underline">
                  {t.clientes.nome}
                </Link>
              </>
            )}
            {t.equipe?.nome && (
              <>
                <span aria-hidden className="bg-muted-foreground/40 size-1 shrink-0 rounded-full" />
                <span>{t.equipe.nome}</span>
              </>
            )}
          </ItemDescription>
          {t.resultado && (
            <ItemDescription className="text-xs whitespace-pre-line">Resultado: {t.resultado}</ItemDescription>
          )}
        </ItemContent>
        <ItemActions className="self-start">
          {situacao === 'atrasada' && <Badge variant="destructive-light">Atrasada</Badge>}
          {situacao === 'hoje' && <Badge variant="warning-light">Hoje</Badge>}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações" disabled={ocupado} />}
            >
              {ocupado ? <Spinner /> : <MoreHorizontalIcon />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {situacao !== 'concluida' && (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Adiar</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => adiar(1)}>
                      <CalendarClockIcon />
                      1 dia
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => adiar(3)}>
                      <CalendarClockIcon />
                      3 dias
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => adiar(7)}>
                      <CalendarClockIcon />1 semana
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem variant="destructive" onClick={excluir}>
                <Trash2Icon />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>

      <Dialog open={concluindo} onOpenChange={setConcluindo}>
        <DialogContent className="sm:max-w-md">
          {concluindo && (
            <ConcluirTarefa
              tarefa={t}
              onCancelar={() => setConcluindo(false)}
              onConcluir={async (resultado) => {
                const ok = await atualizar(
                  { concluida_em: new Date().toISOString(), resultado: resultado || null },
                  'Tarefa concluída'
                )
                if (ok) setConcluindo(false)
              }}
              salvando={ocupado}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConcluirTarefa({
  tarefa,
  onCancelar,
  onConcluir,
  salvando,
}: {
  tarefa: TarefaAgenda
  onCancelar: () => void
  onConcluir: (resultado: string) => void
  salvando: boolean
}) {
  const [resultado, setResultado] = useState('')
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        onConcluir(resultado.trim())
      }}
    >
      <DialogHeader>
        <DialogTitle>Concluir tarefa</DialogTitle>
        <DialogDescription>
          {TIPO_ATIVIDADE_LABEL[tarefa.tipo]}: {tarefa.texto}
        </DialogDescription>
      </DialogHeader>
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="tarefa-resultado">Como foi?</FieldLabel>
          <BotaoVoz
            rotulo="Ditar o resultado"
            onFinal={(falado) => setResultado((atual) => (atual ? `${atual} ${falado}` : falado))}
          />
        </div>
        <Textarea
          id="tarefa-resultado"
          value={resultado}
          onChange={(e) => setResultado(e.target.value)}
          placeholder="Ex.: aprovou o orçamento, quer começar dia 10"
          rows={3}
          autoFocus
        />
        <FieldDescription>Opcional</FieldDescription>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          Concluir
        </Button>
      </DialogFooter>
    </form>
  )
}
