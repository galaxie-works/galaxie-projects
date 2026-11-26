'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { FormaPagamento, Recebimento } from '@/types'
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
import { Spinner } from '@/components/ui/spinner'
import { CampoData } from '@/components/projetos/campo-data'
import { FormaSelect } from './forma-select'

type Props = {
  recebimento: Recebimento | null
  onOpenChange: (aberto: boolean) => void
  hoje: string
  onSalvo: (r: Recebimento) => void
}

// Baixa rápida de uma parcela: quando o dinheiro entrou e por qual forma.
export function ReceberDialog({ recebimento, onOpenChange, hoje, onSalvo }: Props) {
  return (
    <Dialog open={recebimento !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {recebimento && (
          <FormReceber recebimento={recebimento} onOpenChange={onOpenChange} hoje={hoje} onSalvo={onSalvo} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormReceber({
  recebimento: r,
  onOpenChange,
  hoje,
  onSalvo,
}: Props & { recebimento: Recebimento }) {
  const [data, setData] = useState(hoje)
  const [forma, setForma] = useState<FormaPagamento | null>(r.forma ?? 'pix')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!data) {
      setErro('Informe a data em que recebeu.')
      return
    }
    setSalvando(true)
    const { error } = await createClient()
      .from('recebimentos')
      .update({ recebido_em: data, forma })
      .eq('id', r.id)
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível dar baixa', { description: error.message })
      return
    }
    toast.success('Recebimento registrado')
    onSalvo({ ...r, recebido_em: data, forma })
    onOpenChange(false)
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Marcar como recebido</DialogTitle>
        <DialogDescription>
          {r.descricao} · {formatarMoeda(Number(r.valor))} · vence {formatarData(r.vencimento)}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={Boolean(erro) || undefined}>
          <FieldLabel htmlFor="receber-data">Recebido em</FieldLabel>
          <CampoData id="receber-data" valor={data} onChange={setData} invalido={Boolean(erro)} />
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="receber-forma">Forma</FieldLabel>
          <FormaSelect id="receber-forma" valor={forma} onChange={setForma} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          Confirmar recebimento
        </Button>
      </DialogFooter>
    </form>
  )
}
