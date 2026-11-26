'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { STATUS_ETAPA_LABEL, type Etapa, type MembroEquipe, type StatusEtapa } from '@/types'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { CampoData } from '@/components/projetos/campo-data'

const SEM_RESPONSAVEL = 'nenhum'

const ITENS_STATUS = (Object.entries(STATUS_ETAPA_LABEL) as [StatusEtapa, string][]).map(
  ([value, label]) => ({ value, label })
)

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  projetoId: string
  equipe: MembroEquipe[]
  /** Etapa a editar; ausente = nova etapa. */
  etapa?: Etapa | null
  statusInicial?: StatusEtapa
  ordem: number
  onSalva: (etapa: Etapa) => void
}

export function EtapaDialog(props: Props) {
  return (
    <Dialog open={props.aberto} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remonta a cada abertura para começar dos valores certos. */}
        {props.aberto && <FormEtapa {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function FormEtapa({ onOpenChange, projetoId, equipe, etapa, statusInicial, ordem, onSalva }: Props) {
  const [nome, setNome] = useState(etapa?.nome ?? '')
  const [responsavelId, setResponsavelId] = useState(etapa?.responsavel_id ?? SEM_RESPONSAVEL)
  const [status, setStatus] = useState<StatusEtapa>(etapa?.status ?? statusInicial ?? 'pendente')
  const [dataPrazo, setDataPrazo] = useState(etapa?.data_prazo?.slice(0, 10) ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const itensEquipe = [
    { value: SEM_RESPONSAVEL, label: 'Sem responsável' },
    ...equipe.map((m) => ({ value: m.id, label: m.funcao ? `${m.nome} · ${m.funcao}` : m.nome })),
  ]

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome para a etapa.')
      return
    }
    setErro(null)
    setSalvando(true)
    const campos = {
      nome: nome.trim(),
      responsavel_id: responsavelId === SEM_RESPONSAVEL ? null : responsavelId,
      status,
      data_prazo: dataPrazo || null,
    }
    const supabase = createClient()
    const { data, error } = etapa
      ? await supabase.from('etapas').update(campos).eq('id', etapa.id).select('*, equipe(nome)').single()
      : await supabase
          .from('etapas')
          .insert({ projeto_id: projetoId, ordem, ...campos })
          .select('*, equipe(nome)')
          .single()
    setSalvando(false)
    if (error || !data) {
      toast.error('Não foi possível salvar a etapa', { description: error?.message })
      return
    }
    toast.success(etapa ? 'Etapa atualizada' : 'Etapa adicionada')
    onSalva(data as Etapa)
    onOpenChange(false)
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{etapa ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
        <DialogDescription>O que precisa ser feito, por quem e até quando.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={Boolean(erro) || undefined}>
          <FieldLabel htmlFor="etapa-nome">Etapa</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="etapa-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Regularização do contrapiso"
              aria-invalid={Boolean(erro) || undefined}
              autoFocus
            />
            <InputGroupAddon align="inline-end">
              <BotaoVoz size="icon-xs" rotulo="Ditar a etapa" onParcial={setNome} onFinal={setNome} />
            </InputGroupAddon>
          </InputGroup>
          {erro && <FieldError>{erro}</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="etapa-status">Status</FieldLabel>
            <Select items={ITENS_STATUS} value={status} onValueChange={(v) => v && setStatus(v as StatusEtapa)}>
              <SelectTrigger id="etapa-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITENS_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="etapa-prazo">Prazo</FieldLabel>
            <CampoData id="etapa-prazo" valor={dataPrazo} onChange={setDataPrazo} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="etapa-responsavel">Responsável</FieldLabel>
          <Select
            items={itensEquipe}
            value={responsavelId}
            onValueChange={(v) => setResponsavelId((v as string | null) ?? SEM_RESPONSAVEL)}
          >
            <SelectTrigger id="etapa-responsavel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itensEquipe.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          {etapa ? 'Salvar' : 'Adicionar etapa'}
        </Button>
      </DialogFooter>
    </form>
  )
}
