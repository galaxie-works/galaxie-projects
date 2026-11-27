'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { FormaPagamento, Recebimento } from '@/types'
import { useFormularioAssistente } from '@/components/assistente/formulario-assistente'
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
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { CampoData } from '@/components/projetos/campo-data'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { FormaSelect } from './forma-select'

export type ObraFinanceiro = { id: string; empresa_id: string; cliente_id: string }

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  obra: ObraFinanceiro
  /** null = nova parcela. */
  recebimento: Recebimento | null
  proximaOrdem: number
  hoje: string
  onSalvo: (r: Recebimento) => void
}

export function RecebimentoDialog(props: Props) {
  return (
    <Dialog open={props.aberto} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.aberto && <FormRecebimento {...props} />}</DialogContent>
    </Dialog>
  )
}

function FormRecebimento({ onOpenChange, obra, recebimento: r, proximaOrdem, hoje, onSalvo }: Props) {
  const [descricao, setDescricao] = useState(r?.descricao ?? '')
  const [valor, setValor] = useState<number | null>(r ? Number(r.valor) : null)
  const [vencimento, setVencimento] = useState(r?.vencimento ?? hoje)
  const [recebido, setRecebido] = useState(Boolean(r?.recebido_em))
  const [recebidoEm, setRecebidoEm] = useState(r?.recebido_em ?? hoje)
  const [forma, setForma] = useState<FormaPagamento | null>(r?.forma ?? null)
  const [erros, setErros] = useState<{ descricao?: string; valor?: string; vencimento?: string }>({})
  const [salvando, setSalvando] = useState(false)

  useFormularioAssistente({
    id: r ? 'recebimento-editar' : 'recebimento-novo',
    titulo: r ? 'Editar parcela' : 'Nova parcela a receber',
    descricao: 'Parcela que o cliente paga por esta obra.',
    campos: [
      { nome: 'descricao', descricao: 'Nome da parcela, ex.: Entrada, Meio da obra', esquema: { type: 'string' } },
      { nome: 'valor', descricao: 'Valor em reais', esquema: { type: 'number' } },
      { nome: 'vencimento', descricao: 'Data de vencimento AAAA-MM-DD', esquema: { type: 'string' } },
      { nome: 'recebido_em', descricao: 'Data em que recebeu (AAAA-MM-DD) ou vazio se ainda não recebeu', esquema: { type: 'string' } },
      {
        nome: 'forma',
        descricao: 'Forma de pagamento',
        esquema: { type: 'string', enum: ['pix', 'boleto', 'cartao', 'dinheiro', 'transferencia'] },
      },
    ],
    valores: () => ({ descricao, valor, vencimento, recebido_em: recebido ? recebidoEm : '', forma }),
    preencher: (v) => {
      if (typeof v.descricao === 'string') setDescricao(v.descricao)
      if (typeof v.valor === 'number') setValor(v.valor)
      if (typeof v.vencimento === 'string' && v.vencimento) setVencimento(v.vencimento)
      if (typeof v.recebido_em === 'string') {
        setRecebido(Boolean(v.recebido_em))
        if (v.recebido_em) setRecebidoEm(v.recebido_em)
      }
      if (typeof v.forma === 'string') setForma(v.forma as FormaPagamento)
    },
  })

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const novos: typeof erros = {}
    if (!descricao.trim()) novos.descricao = 'Dê um nome à parcela.'
    if (!valor || valor <= 0) novos.valor = 'Informe o valor.'
    if (!vencimento) novos.vencimento = 'Informe o vencimento.'
    setErros(novos)
    if (Object.keys(novos).length > 0) return

    const dados = {
      descricao: descricao.trim(),
      valor,
      vencimento,
      recebido_em: recebido ? recebidoEm || hoje : null,
      forma,
    }
    setSalvando(true)
    const supabase = createClient()
    const { data, error } = r
      ? await supabase.from('recebimentos').update(dados).eq('id', r.id).select('*').single()
      : await supabase
          .from('recebimentos')
          .insert({
            ...dados,
            empresa_id: obra.empresa_id,
            projeto_id: obra.id,
            cliente_id: obra.cliente_id,
            ordem: proximaOrdem,
          })
          .select('*')
          .single()
    setSalvando(false)
    if (error || !data) {
      toast.error('Não foi possível salvar a parcela', { description: error?.message })
      return
    }
    toast.success(r ? 'Parcela atualizada' : 'Parcela criada')
    onSalvo({ ...(r ?? {}), ...(data as Recebimento) })
    onOpenChange(false)
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{r ? 'Editar parcela' : 'Nova parcela'}</DialogTitle>
        <DialogDescription>Valor que o cliente paga por esta obra.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={Boolean(erros.descricao) || undefined}>
          <FieldLabel htmlFor="parcela-descricao">Parcela</FieldLabel>
          <Input
            id="parcela-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Entrada, Meio da obra, Entrega"
            aria-invalid={Boolean(erros.descricao) || undefined}
            autoFocus
          />
          {erros.descricao && <FieldError>{erros.descricao}</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(erros.valor) || undefined}>
            <FieldLabel htmlFor="parcela-valor">Valor</FieldLabel>
            <CampoMoeda id="parcela-valor" valor={valor} onChange={setValor} invalido={Boolean(erros.valor)} />
            {erros.valor && <FieldError>{erros.valor}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(erros.vencimento) || undefined}>
            <FieldLabel htmlFor="parcela-vencimento">Vencimento</FieldLabel>
            <CampoData
              id="parcela-vencimento"
              valor={vencimento}
              onChange={setVencimento}
              invalido={Boolean(erros.vencimento)}
            />
            {erros.vencimento && <FieldError>{erros.vencimento}</FieldError>}
          </Field>
        </div>

        <Field orientation="horizontal">
          <Switch id="parcela-recebido" checked={recebido} onCheckedChange={setRecebido} />
          <FieldLabel htmlFor="parcela-recebido">Já recebido</FieldLabel>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {recebido && (
            <Field>
              <FieldLabel htmlFor="parcela-recebido-em">Recebido em</FieldLabel>
              <CampoData id="parcela-recebido-em" valor={recebidoEm} onChange={setRecebidoEm} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="parcela-forma">Forma</FieldLabel>
            <FormaSelect id="parcela-forma" valor={forma} onChange={setForma} />
          </Field>
        </div>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          {r ? 'Salvar' : 'Criar parcela'}
        </Button>
      </DialogFooter>
    </form>
  )
}
