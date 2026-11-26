'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { montarPrevisto } from '@/lib/agenda'
import type { MembroEquipe } from '@/types'
import {
  CamposProximoPasso,
  linhaProximoPasso,
  proximoPassoVazio,
  type ProximoPasso,
} from './campos-proximo-passo'

type ClienteOpcao = { id: string; nome: string; responsavel_id?: string | null }

type Props = {
  empresaId: string
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  hoje: string
  /** Cliente fixo (painel do cliente). Sem ele, o formulário pede o cliente. */
  cliente?: ClienteOpcao
  clientes?: ClienteOpcao[]
  /** Dia inicial (ex.: o dia aberto na Agenda). */
  dia?: string
  disponivel?: boolean
  variante?: 'default' | 'outline'
}

// Botão + diálogo para agendar uma tarefa ou próximo passo com um cliente.
export function NovaTarefa({ variante = 'default', disponivel = true, ...props }: Props) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button variant={variante} onClick={() => setAberto(true)} disabled={!disponivel}>
        <PlusIcon data-icon="inline-start" />
        Nova tarefa
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-xl">
          {aberto && <FormTarefa {...props} onFechar={() => setAberto(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function FormTarefa({
  empresaId,
  equipe,
  hoje,
  cliente,
  clientes = [],
  dia,
  onFechar,
}: Omit<Props, 'variante' | 'disponivel'> & { onFechar: () => void }) {
  const router = useRouter()
  const [escolhido, setEscolhido] = useState<ClienteOpcao | null>(cliente ?? null)
  const [passo, setPasso] = useState<ProximoPasso>(() => {
    const base = proximoPassoVazio(hoje, cliente?.responsavel_id)
    return dia && dia >= hoje ? { ...base, dia } : base
  })
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!escolhido) {
      setErro('Escolha o cliente.')
      return
    }
    setSalvando(true)
    const { error } = await createClient()
      .from('atividades')
      .insert(linhaProximoPasso(passo, { clienteId: escolhido.id, empresaId }, montarPrevisto))
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível agendar', { description: error.message })
      return
    }
    toast.success('Tarefa agendada', { description: escolhido.nome })
    onFechar()
    router.refresh()
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Nova tarefa</DialogTitle>
        <DialogDescription>
          {cliente ? `Próximo passo com ${cliente.nome}.` : 'Ligação, visita ou retorno agendado com um cliente.'}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        {!cliente && (
          <Field data-invalid={Boolean(erro) || undefined}>
            <FieldLabel htmlFor="tarefa-cliente">Cliente</FieldLabel>
            <Combobox
              items={clientes}
              value={escolhido}
              onValueChange={(v) => {
                const c = v as ClienteOpcao | null
                setEscolhido(c)
                setErro(null)
                if (c?.responsavel_id) setPasso((p) => ({ ...p, responsavel: c.responsavel_id as string }))
              }}
              itemToStringLabel={(c) => (c as ClienteOpcao).nome}
              isItemEqualToValue={(a, b) => (a as ClienteOpcao).id === (b as ClienteOpcao).id}
            >
              <ComboboxInput
                id="tarefa-cliente"
                placeholder="Buscar cliente"
                className="w-full"
                aria-invalid={Boolean(erro) || undefined}
              />
              <ComboboxContent>
                <ComboboxEmpty>Nenhum cliente encontrado.</ComboboxEmpty>
                <ComboboxList>
                  {(c: ClienteOpcao) => (
                    <ComboboxItem key={c.id} value={c}>
                      {c.nome}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {erro && <FieldError>{erro}</FieldError>}
          </Field>
        )}
        <CamposProximoPasso idBase="nova-tarefa" valor={passo} onChange={setPasso} equipe={equipe} hoje={hoje} />
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          Agendar
        </Button>
      </DialogFooter>
    </form>
  )
}
