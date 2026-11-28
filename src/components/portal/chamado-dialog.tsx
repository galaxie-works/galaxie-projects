'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import { abrirChamado } from '@/app/portal/[token]/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const SEM_OBRA = '__sem_obra__'

// Cliente final abre um chamado de assistência pelo portal. Vira um item de
// pós-venda (assistência) na conta da empresa, marcado "pelo portal".
export function ChamadoDialog({ token, obras }: { token: string; obras: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button size="sm" className="shrink-0" />}>
        <PlusIcon data-icon="inline-start" />
        Abrir chamado
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {aberto && <ChamadoForm token={token} obras={obras} onFechar={() => setAberto(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ChamadoForm({
  token,
  obras,
  onFechar,
}: {
  token: string
  obras: { id: string; nome: string }[]
  onFechar: () => void
}) {
  const router = useRouter()
  const [projetoId, setProjetoId] = useState(obras[0]?.id ?? SEM_OBRA)
  const [texto, setTexto] = useState('')
  const [tentou, setTentou] = useState(false)
  const [salvando, iniciar] = useTransition()
  const itensObra = [...obras.map((o) => ({ value: o.id, label: o.nome })), { value: SEM_OBRA, label: 'Outro assunto' }]
  const limpo = texto.trim()
  const erro = tentou && limpo.length < 3 ? 'Conte em poucas palavras o que aconteceu.' : null

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (limpo.length < 3) return
    // Título = começo da primeira linha; o texto completo vai junto.
    const primeira = limpo.split('\n')[0].trim()
    const titulo = primeira.length > 80 ? `${primeira.slice(0, 77)}…` : primeira
    iniciar(async () => {
      const r = await abrirChamado(token, {
        projetoId: projetoId === SEM_OBRA ? null : projetoId,
        titulo,
        texto: limpo,
      })
      if (!r.ok) {
        toast.error(r.erro)
        return
      }
      toast.success('Chamado enviado', { description: 'A empresa recebeu e vai entrar em contato.' })
      onFechar()
      router.refresh()
    })
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Abrir chamado</DialogTitle>
        <DialogDescription>A empresa recebe na hora.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {obras.length > 0 && (
          <Field>
            <FieldLabel htmlFor="portal-chamado-obra">Obra</FieldLabel>
            <Select items={itensObra} value={projetoId} onValueChange={(v) => v && setProjetoId(v as string)}>
              <SelectTrigger id="portal-chamado-obra" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itensObra.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field data-invalid={!!erro || undefined}>
          <FieldLabel htmlFor="portal-chamado-texto">O que aconteceu</FieldLabel>
          <Textarea
            id="portal-chamado-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            rows={4}
            aria-invalid={!!erro || undefined}
            placeholder="Ex.: o rejunte do box está soltando perto do ralo"
          />
          {erro ? <FieldError>{erro}</FieldError> : <FieldDescription>Onde fica e desde quando acontece.</FieldDescription>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          Enviar chamado
        </Button>
      </DialogFooter>
    </form>
  )
}
