'use client'

import { useState } from 'react'
import { MOTIVOS_PERDA } from '@/types'
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
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Spinner } from '@/components/ui/spinner'

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  titulo: string
  /** Devolve false se não conseguiu salvar (o diálogo fica aberto). */
  onConfirmar: (motivo: string) => Promise<boolean>
}

// Motivo de perda é obrigatório: é o que mostra onde a venda escapa.
export function PerderDialog(props: Props) {
  return (
    <Dialog open={props.aberto} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.aberto && <FormPerder {...props} />}</DialogContent>
    </Dialog>
  )
}

function FormPerder({ onOpenChange, titulo, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState<string>('')
  const [detalhe, setDetalhe] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo) {
      setErro('Escolha o motivo.')
      return
    }
    if (motivo === 'Outro' && !detalhe.trim()) {
      setErro('Conte o que aconteceu.')
      return
    }
    setSalvando(true)
    const texto = detalhe.trim() ? `${motivo}: ${detalhe.trim()}` : motivo
    const ok = await onConfirmar(texto)
    setSalvando(false)
    if (ok) onOpenChange(false)
  }

  return (
    <form onSubmit={confirmar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Marcar como perdido</DialogTitle>
        <DialogDescription>{titulo}. Por que não fechou?</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={Boolean(erro) || undefined}>
          <FieldLabel>Motivo</FieldLabel>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={motivo ? [motivo] : []}
            onValueChange={(v) => {
              setMotivo((v[0] as string | undefined) ?? '')
              setErro(null)
            }}
            aria-label="Motivo da perda"
            className="flex-wrap"
          >
            {MOTIVOS_PERDA.map((m) => (
              <ToggleGroupItem key={m} value={m}>
                {m}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="perda-detalhe">Detalhe (opcional)</FieldLabel>
          <Textarea
            id="perda-detalhe"
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Ex.: achou mais barato com outro instalador"
            rows={2}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          Marcar perdido
        </Button>
      </DialogFooter>
    </form>
  )
}
