'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarMoeda } from '@/lib/formato'
import { gerarParcelas, PLANOS_PADRAO, somarMeses, type ParcelaPlano } from '@/lib/financeiro'
import type { Recebimento } from '@/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CampoData } from '@/components/projetos/campo-data'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import type { ObraFinanceiro } from './recebimento-dialog'

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  obra: ObraFinanceiro
  /** Valor da obra (orçamento) usado como base. */
  totalObra: number
  /** Já existem parcelas: o plano é somado a elas. */
  jaTemParcelas: boolean
  proximaOrdem: number
  hoje: string
  onCriadas: (novas: Recebimento[]) => void
}

export function PlanoPagamentoDialog(props: Props) {
  return (
    <Dialog open={props.aberto} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-xl">{props.aberto && <FormPlano {...props} />}</DialogContent>
    </Dialog>
  )
}

function FormPlano({ onOpenChange, obra, totalObra, jaTemParcelas, proximaOrdem, hoje, onCriadas }: Props) {
  const [planoId, setPlanoId] = useState(PLANOS_PADRAO[0].id)
  const [total, setTotal] = useState<number | null>(totalObra > 0 ? totalObra : null)
  const [primeiro, setPrimeiro] = useState(hoje)
  const [parcelas, setParcelas] = useState<ParcelaPlano[]>(() =>
    gerarParcelas(totalObra, PLANOS_PADRAO[0].percentuais, hoje)
  )
  const [salvando, setSalvando] = useState(false)

  function refazer(id: string, valorTotal: number | null, data: string) {
    const plano = PLANOS_PADRAO.find((p) => p.id === id) ?? PLANOS_PADRAO[0]
    setParcelas(gerarParcelas(valorTotal ?? 0, plano.percentuais, data || hoje))
  }

  function mudarParcela(i: number, parte: Partial<ParcelaPlano>) {
    setParcelas((lista) => lista.map((p, j) => (j === i ? { ...p, ...parte } : p)))
  }

  const soma = parcelas.reduce((s, p) => s + p.valor, 0)
  const diferenca = Math.round(((total ?? 0) - soma) * 100) / 100
  const valido = parcelas.length > 0 && parcelas.every((p) => p.descricao.trim() && p.valor > 0 && p.vencimento)

  async function salvar() {
    if (!valido) return
    setSalvando(true)
    const { data, error } = await createClient()
      .from('recebimentos')
      .insert(
        parcelas.map((p, i) => ({
          empresa_id: obra.empresa_id,
          projeto_id: obra.id,
          cliente_id: obra.cliente_id,
          descricao: p.descricao.trim(),
          valor: p.valor,
          vencimento: p.vencimento,
          ordem: proximaOrdem + i,
        }))
      )
      .select('*')
    setSalvando(false)
    if (error || !data) {
      toast.error('Não foi possível criar as parcelas', { description: error?.message })
      return
    }
    toast.success(`${data.length} ${data.length === 1 ? 'parcela criada' : 'parcelas criadas'}`)
    onCriadas(data as Recebimento[])
    onOpenChange(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Plano de pagamento</DialogTitle>
        <DialogDescription>Escolha como o cliente vai pagar. As parcelas podem ser ajustadas antes de criar.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field>
          <FieldLabel>Divisão</FieldLabel>
          <ToggleGroup
            variant="outline"
            size="sm"
            className="flex-wrap"
            value={[planoId]}
            onValueChange={(v) => {
              const id = v[0] as string | undefined
              if (!id) return
              setPlanoId(id)
              refazer(id, total, primeiro)
            }}
          >
            {PLANOS_PADRAO.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.rotulo}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="plano-total">Valor total</FieldLabel>
            <CampoMoeda
              id="plano-total"
              valor={total}
              onChange={(v) => {
                setTotal(v)
                refazer(planoId, v, primeiro)
              }}
            />
            <FieldDescription>
              {totalObra > 0 ? `Orçamento da obra: ${formatarMoeda(totalObra)}` : 'A obra ainda não tem orçamento.'}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="plano-primeiro">Primeiro vencimento</FieldLabel>
            <CampoData
              id="plano-primeiro"
              valor={primeiro}
              onChange={(d) => {
                setPrimeiro(d)
                refazer(planoId, total, d)
              }}
            />
            <FieldDescription>As outras vencem de mês em mês.</FieldDescription>
          </Field>
        </div>
      </FieldGroup>

      <Separator />

      <ol className="flex flex-col gap-4">
        {parcelas.map((p, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_12.5rem] sm:items-end">
            <Field>
              <FieldLabel htmlFor={`plano-desc-${i}`} className="text-xs">
                {i + 1}ª parcela · {p.percentual}%
              </FieldLabel>
              <Input
                id={`plano-desc-${i}`}
                value={p.descricao}
                onChange={(e) => mudarParcela(i, { descricao: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <CampoMoeda valor={p.valor} onChange={(v) => mudarParcela(i, { valor: v ?? 0 })} />
              <CampoData valor={p.vencimento} onChange={(d) => mudarParcela(i, { vencimento: d || somarMeses(primeiro, i) })} />
            </div>
          </li>
        ))}
      </ol>

      {Math.abs(diferenca) >= 0.01 && (
        <Alert variant="warning">
          <AlertTitle>As parcelas somam {formatarMoeda(soma)}</AlertTitle>
          <AlertDescription>
            {diferenca > 0 ? `Faltam ${formatarMoeda(diferenca)}` : `Passa ${formatarMoeda(-diferenca)}`} do valor total.
          </AlertDescription>
        </Alert>
      )}
      {jaTemParcelas && (
        <Alert variant="info">
          <AlertDescription>Esta obra já tem parcelas. As novas serão somadas às que existem.</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="button" onClick={salvar} disabled={salvando || !valido}>
          {salvando && <Spinner data-icon="inline-start" />}
          Criar {parcelas.length} {parcelas.length === 1 ? 'parcela' : 'parcelas'}
        </Button>
      </DialogFooter>
    </div>
  )
}
