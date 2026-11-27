'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { SELECT_NEGOCIO } from '@/lib/negocios'
import { FASE_NEGOCIO_LABEL, type FaseNegocio, type MembroEquipe, type Negocio } from '@/types'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { CampoData } from '@/components/projetos/campo-data'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { FASES_ABERTAS } from '@/lib/negocios'

const SEM_RESPONSAVEL = 'nenhum'

export type ClienteOpcao = { id: string; nome: string }

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  empresaId: string
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  /** Clientes para escolher; com `clienteId` fixo, o campo some. */
  clientes?: ClienteOpcao[]
  clienteId?: string
  negocio?: Negocio | null
  faseInicial?: FaseNegocio
  ordem?: number
  onSalvo: (negocio: Negocio) => void
}

export function NegocioDialog(props: Props) {
  return (
    <Dialog open={props.aberto} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">{props.aberto && <FormNegocio {...props} />}</DialogContent>
    </Dialog>
  )
}

function FormNegocio({
  onOpenChange,
  empresaId,
  equipe,
  clientes = [],
  clienteId: clienteFixo,
  negocio,
  faseInicial,
  ordem = 0,
  onSalvo,
}: Props) {
  const [titulo, setTitulo] = useState(negocio?.titulo ?? '')
  const [clienteId, setClienteId] = useState(negocio?.cliente_id ?? clienteFixo ?? '')
  const [fase, setFase] = useState<FaseNegocio>(negocio?.fase ?? faseInicial ?? 'novo')
  const [valor, setValor] = useState<number | null>(negocio?.valor_estimado ?? null)
  const [previsao, setPrevisao] = useState(negocio?.previsao_fechamento ?? '')
  const [responsavel, setResponsavel] = useState(negocio?.responsavel_id ?? SEM_RESPONSAVEL)
  const [erros, setErros] = useState<{ titulo?: string; cliente?: string }>({})
  const [salvando, setSalvando] = useState(false)

  const fechado = negocio?.fase === 'ganho' || negocio?.fase === 'perdido'
  const itensFase = FASES_ABERTAS.map((f) => ({ value: f, label: FASE_NEGOCIO_LABEL[f] }))
  const itensClientes = clientes.map((c) => ({ value: c.id, label: c.nome }))
  const itensEquipe = [
    { value: SEM_RESPONSAVEL, label: 'Sem responsável' },
    ...equipe.map((m) => ({ value: m.id, label: m.nome })),
  ]

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const novosErros: typeof erros = {}
    if (!titulo.trim()) novosErros.titulo = 'Diga o que o cliente quer fazer.'
    if (!clienteId) novosErros.cliente = 'Escolha o cliente.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setSalvando(true)
    const campos = {
      titulo: titulo.trim(),
      cliente_id: clienteId,
      valor_estimado: valor,
      previsao_fechamento: previsao || null,
      responsavel_id: responsavel === SEM_RESPONSAVEL ? null : responsavel,
      ...(fechado ? {} : { fase }),
    }
    const supabase = createClient()
    const { data, error } = negocio
      ? await supabase.from('negocios').update(campos).eq('id', negocio.id).select(SELECT_NEGOCIO).single()
      : await supabase
          .from('negocios')
          .insert({ ...campos, empresa_id: empresaId, ordem })
          .select(SELECT_NEGOCIO)
          .single()
    setSalvando(false)
    if (error || !data) {
      toast.error('Não foi possível salvar o negócio', { description: error?.message })
      return
    }
    toast.success(negocio ? 'Negócio atualizado' : 'Negócio aberto')
    onSalvo(data as unknown as Negocio)
    onOpenChange(false)
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{negocio ? 'Editar negócio' : 'Novo negócio'}</DialogTitle>
        <DialogDescription>Uma oportunidade de obra: o que, para quem e quanto deve valer.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={Boolean(erros.titulo) || undefined}>
          <FieldLabel htmlFor="negocio-titulo">O que o cliente quer</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="negocio-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Piso da sala e cozinha"
              aria-invalid={Boolean(erros.titulo) || undefined}
              autoFocus
            />
            <InputGroupAddon align="inline-end">
              <BotaoVoz size="icon-xs" rotulo="Ditar o negócio" onParcial={setTitulo} onFinal={setTitulo} />
            </InputGroupAddon>
          </InputGroup>
          {erros.titulo && <FieldError>{erros.titulo}</FieldError>}
        </Field>

        {!clienteFixo && (
          <Field data-invalid={Boolean(erros.cliente) || undefined}>
            <FieldLabel htmlFor="negocio-cliente">Cliente</FieldLabel>
            <Select
              items={itensClientes}
              value={clienteId || null}
              onValueChange={(v) => setClienteId((v as string | null) ?? '')}
            >
              <SelectTrigger id="negocio-cliente" className="w-full" aria-invalid={Boolean(erros.cliente) || undefined}>
                <SelectValue placeholder="Escolha o cliente" />
              </SelectTrigger>
              <SelectContent>
                {itensClientes.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.cliente && <FieldError>{erros.cliente}</FieldError>}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="negocio-valor">Valor estimado</FieldLabel>
            <CampoMoeda id="negocio-valor" valor={valor} onChange={setValor} />
            <FieldDescription>Com orçamento feito, vale o total do orçamento.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="negocio-previsao">Previsão de fechar</FieldLabel>
            <CampoData id="negocio-previsao" valor={previsao} onChange={setPrevisao} placeholder="Sem data" />
          </Field>
          {!fechado && (
            <Field>
              <FieldLabel htmlFor="negocio-fase">Fase</FieldLabel>
              <Select items={itensFase} value={fase} onValueChange={(v) => v && setFase(v as FaseNegocio)}>
                <SelectTrigger id="negocio-fase" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itensFase.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="negocio-responsavel">Responsável</FieldLabel>
            <Select
              items={itensEquipe}
              value={responsavel}
              onValueChange={(v) => setResponsavel((v as string | null) ?? SEM_RESPONSAVEL)}
            >
              <SelectTrigger id="negocio-responsavel" className="w-full">
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
        </div>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          {negocio ? 'Salvar' : 'Abrir negócio'}
        </Button>
      </DialogFooter>
    </form>
  )
}
