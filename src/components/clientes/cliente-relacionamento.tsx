'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CampoData } from '@/components/projetos/campo-data'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { VARIANTE_FASE_CLIENTE } from '@/lib/status'
import { formatarData } from '@/lib/formato'
import {
  FASE_CLIENTE_LABEL,
  FASES_CLIENTE,
  ORIGENS_CLIENTE,
  TEMPERATURA_LABEL,
  type Cliente,
  type FaseCliente,
  type MembroEquipe,
  type TemperaturaCliente,
} from '@/types'

const AUTOMATICA = 'automatica'
const NINGUEM = 'ninguem'

type Props = {
  cliente: Cliente
  faseCalculada: FaseCliente
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  /** false quando as colunas novas ainda não existem no banco. */
  disponivel: boolean
  /** Com a agenda ativa, o follow-up vem das tarefas e não é editado aqui. */
  agendaDisponivel?: boolean
}

// Campos de relacionamento: fase (automática ou ajustada), temperatura,
// origem, responsável, próximo follow-up e observações.
export function ClienteRelacionamento({ cliente, faseCalculada, equipe, disponivel, agendaDisponivel }: Props) {
  const router = useRouter()
  const [fase, setFase] = useState<string>(cliente.fase_manual ?? AUTOMATICA)
  const [temperatura, setTemperatura] = useState<TemperaturaCliente | ''>(cliente.temperatura ?? '')
  const [origem, setOrigem] = useState(cliente.origem ?? '')
  const [responsavel, setResponsavel] = useState(cliente.responsavel_id ?? NINGUEM)
  const [followup, setFollowup] = useState(cliente.proximo_followup_em ?? '')
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)

  const itensFase = [
    { value: AUTOMATICA, label: `Automática (${FASE_CLIENTE_LABEL[faseCalculada]})` },
    ...FASES_CLIENTE.map((f) => ({ value: f, label: FASE_CLIENTE_LABEL[f] })),
  ]
  const itensOrigem = ORIGENS_CLIENTE.map((o) => ({ value: o, label: o }))
  const itensResponsavel = [
    { value: NINGUEM, label: 'Sem responsável' },
    ...equipe.map((m) => ({ value: m.id, label: m.nome })),
  ]

  async function salvar() {
    setSalvando(true)
    const { error } = await createClient()
      .from('clientes')
      .update({
        fase_manual: fase === AUTOMATICA ? null : fase,
        temperatura: temperatura || null,
        origem: origem || null,
        responsavel_id: responsavel === NINGUEM ? null : responsavel,
        ...(agendaDisponivel ? {} : { proximo_followup_em: followup || null }),
        observacoes: observacoes.trim() || null,
      })
      .eq('id', cliente.id)
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível salvar', { description: error.message })
      return
    }
    toast.success('Relacionamento atualizado')
    router.refresh()
  }

  return (
    <FieldGroup>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="cliente-fase">Fase</FieldLabel>
          <Select items={itensFase} value={fase} onValueChange={(v) => v && setFase(v as string)}>
            <SelectTrigger id="cliente-fase" className="w-full">
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
          <FieldDescription>
            Automática segue as obras. Mude só para corrigir.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Temperatura</FieldLabel>
          <ToggleGroup
            variant="outline"
            value={temperatura ? [temperatura] : []}
            onValueChange={(valor) => setTemperatura((valor[0] as TemperaturaCliente | undefined) ?? '')}
            aria-label="Temperatura do cliente"
          >
            {(Object.keys(TEMPERATURA_LABEL) as TemperaturaCliente[]).map((t) => (
              <ToggleGroupItem key={t} value={t}>
                {TEMPERATURA_LABEL[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field>
          <FieldLabel htmlFor="cliente-origem">Origem</FieldLabel>
          <Select items={itensOrigem} value={origem || null} onValueChange={(v) => setOrigem((v as string | null) ?? '')}>
            <SelectTrigger id="cliente-origem" className="w-full">
              <SelectValue placeholder="De onde veio" />
            </SelectTrigger>
            <SelectContent>
              {itensOrigem.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="cliente-responsavel">Responsável</FieldLabel>
          <Select
            items={itensResponsavel}
            value={responsavel}
            onValueChange={(v) => v && setResponsavel(v as string)}
          >
            <SelectTrigger id="cliente-responsavel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itensResponsavel.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="cliente-followup">Próximo follow-up</FieldLabel>
          {agendaDisponivel ? (
            <>
              <p id="cliente-followup" className="text-sm">
                {cliente.proximo_followup_em ? formatarData(cliente.proximo_followup_em) : 'Sem data'}
              </p>
              <FieldDescription>Vem da próxima tarefa aberta.</FieldDescription>
            </>
          ) : (
            <CampoData id="cliente-followup" valor={followup} onChange={setFollowup} placeholder="Sem data" />
          )}
        </Field>
      </div>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="cliente-observacoes">Observações</FieldLabel>
          <BotaoVoz
            rotulo="Ditar observações"
            onFinal={(falado) => setObservacoes((atual) => (atual ? `${atual} ${falado}` : falado))}
          />
        </div>
        <Textarea
          id="cliente-observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Preferências, quem decide, restrições de horário…"
          rows={3}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {fase !== AUTOMATICA ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Fase ajustada à mão:
            <Badge variant={VARIANTE_FASE_CLIENTE[fase as FaseCliente]}>
              {FASE_CLIENTE_LABEL[fase as FaseCliente]}
            </Badge>
          </span>
        ) : (
          <span />
        )}
        <Button onClick={salvar} disabled={!disponivel || salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          Salvar
        </Button>
      </div>
      {!disponivel && (
        <p className="text-xs text-muted-foreground">
          Indisponível no momento. Tente de novo mais tarde.
        </p>
      )}
    </FieldGroup>
  )
}
