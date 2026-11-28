'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Compra, MembroEquipe } from '@/types'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { CampoData } from '@/components/projetos/campo-data'
import { CampoMoeda } from '@/components/projetos/campo-moeda'

const SEM_RESPONSAVEL = 'nenhum'

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  projetoId: string
  equipe: MembroEquipe[]
  onSalva: (compra: Compra) => void
}

export function CompraDialog(props: Props) {
  return (
    <Dialog open={props.aberto} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.aberto && <FormCompra {...props} />}</DialogContent>
    </Dialog>
  )
}

function FormCompra({ onOpenChange, projetoId, equipe, onSalva }: Props) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [responsavelId, setResponsavelId] = useState(SEM_RESPONSAVEL)
  const [data, setData] = useState('')
  const [erros, setErros] = useState<{ descricao?: string; valor?: string }>({})
  const [salvando, setSalvando] = useState(false)

  const itensEquipe = [
    { value: SEM_RESPONSAVEL, label: 'Sem responsável' },
    ...equipe.map((m) => ({ value: m.id, label: m.nome })),
  ]

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const novos: typeof erros = {}
    if (!descricao.trim()) novos.descricao = 'Descreva o que foi comprado.'
    if (!valor || valor <= 0) novos.valor = 'Informe o valor.'
    setErros(novos)
    if (Object.keys(novos).length > 0) return

    setSalvando(true)
    const { data: nova, error } = await createClient()
      .from('compras')
      .insert({
        projeto_id: projetoId,
        descricao: descricao.trim(),
        valor,
        responsavel_id: responsavelId === SEM_RESPONSAVEL ? null : responsavelId,
        data: data || null,
      })
      .select('*, equipe(nome)')
      .single()
    setSalvando(false)
    if (error || !nova) {
      toast.error('Não foi possível salvar a compra', { description: error?.message })
      return
    }
    toast.success('Compra registrada')
    onSalva(nova as Compra)
    onOpenChange(false)
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Nova compra</DialogTitle>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={Boolean(erros.descricao) || undefined}>
          <FieldLabel htmlFor="compra-descricao">Descrição</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="compra-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: 12 sacos de argamassa AC-III"
              aria-invalid={Boolean(erros.descricao) || undefined}
              autoFocus
            />
            <InputGroupAddon align="inline-end">
              <BotaoVoz
                size="icon-xs"
                rotulo="Ditar a compra"
                onParcial={setDescricao}
                onFinal={setDescricao}
              />
            </InputGroupAddon>
          </InputGroup>
          {erros.descricao && <FieldError>{erros.descricao}</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(erros.valor) || undefined}>
            <FieldLabel htmlFor="compra-valor">Valor</FieldLabel>
            <CampoMoeda id="compra-valor" valor={valor} onChange={setValor} invalido={Boolean(erros.valor)} />
            {erros.valor && <FieldError>{erros.valor}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="compra-data">Data</FieldLabel>
            <CampoData id="compra-data" valor={data} onChange={setData} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="compra-responsavel">Quem comprou</FieldLabel>
          <Select
            items={itensEquipe}
            value={responsavelId}
            onValueChange={(v) => setResponsavelId((v as string | null) ?? SEM_RESPONSAVEL)}
          >
            <SelectTrigger id="compra-responsavel" className="w-full">
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
          Registrar compra
        </Button>
      </DialogFooter>
    </form>
  )
}
