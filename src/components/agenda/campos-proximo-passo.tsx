'use client'

import { CampoData } from '@/components/projetos/campo-data'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ATALHOS_PRAZO, TIPOS_PROXIMO_PASSO, somarDias } from '@/lib/agenda'
import { TIPO_ATIVIDADE_LABEL, type MembroEquipe, type TipoAtividade } from '@/types'

export const SEM_RESPONSAVEL = 'ninguem'

export type ProximoPasso = {
  tipo: TipoAtividade
  dia: string
  hora: string
  texto: string
  responsavel: string
}

export function proximoPassoVazio(hoje: string, responsavel?: string | null): ProximoPasso {
  return {
    tipo: 'ligacao',
    dia: somarDias(hoje, 1),
    hora: '09:00',
    texto: '',
    responsavel: responsavel ?? SEM_RESPONSAVEL,
  }
}

type Props = {
  idBase: string
  valor: ProximoPasso
  onChange: (valor: ProximoPasso) => void
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  hoje: string
  disabled?: boolean
}

// Campos do próximo passo: o que fazer, quando (atalhos + data + hora) e quem.
export function CamposProximoPasso({ idBase, valor, onChange, equipe, hoje, disabled }: Props) {
  const set = (parcial: Partial<ProximoPasso>) => onChange({ ...valor, ...parcial })
  const itensTipo = TIPOS_PROXIMO_PASSO.map((t) => ({ value: t, label: TIPO_ATIVIDADE_LABEL[t] }))
  const itensResponsavel = [
    { value: SEM_RESPONSAVEL, label: 'Sem responsável' },
    ...equipe.map((m) => ({ value: m.id, label: m.nome })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field>
          <FieldLabel htmlFor={`${idBase}-tipo`}>O quê</FieldLabel>
          <Select
            items={itensTipo}
            value={valor.tipo}
            onValueChange={(v) => v && set({ tipo: v as TipoAtividade })}
            disabled={disabled}
          >
            <SelectTrigger id={`${idBase}-tipo`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itensTipo.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idBase}-texto`}>Descrição</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={`${idBase}-texto`}
              value={valor.texto}
              onChange={(e) => set({ texto: e.target.value })}
              placeholder="Ex.: retornar sobre o desconto do rodapé"
              disabled={disabled}
            />
            <InputGroupAddon align="inline-end">
              <BotaoVoz
                size="icon-xs"
                rotulo="Ditar o próximo passo"
                onParcial={(texto) => set({ texto })}
                onFinal={(texto) => set({ texto })}
              />
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ATALHOS_PRAZO.map((a) => {
          const dia = somarDias(hoje, a.dias)
          return (
            <Button
              key={a.dias}
              type="button"
              size="xs"
              variant={valor.dia === dia ? 'secondary' : 'outline'}
              onClick={() => set({ dia })}
              disabled={disabled}
            >
              {a.rotulo}
            </Button>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)]">
        <Field>
          <FieldLabel htmlFor={`${idBase}-dia`}>Dia</FieldLabel>
          <CampoData id={`${idBase}-dia`} valor={valor.dia} onChange={(dia) => set({ dia })} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idBase}-hora`}>Hora</FieldLabel>
          <Input
            id={`${idBase}-hora`}
            type="time"
            value={valor.hora}
            onChange={(e) => set({ hora: e.target.value })}
            disabled={disabled}
            className="tabular-nums"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idBase}-responsavel`}>Responsável</FieldLabel>
          <Select
            items={itensResponsavel}
            value={valor.responsavel}
            onValueChange={(v) => v && set({ responsavel: v as string })}
            disabled={disabled}
          >
            <SelectTrigger id={`${idBase}-responsavel`} className="w-full">
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
      </div>
    </div>
  )
}

/** Linha pronta para inserir em `atividades`. */
export function linhaProximoPasso(
  p: ProximoPasso,
  ids: { clienteId: string; empresaId: string; projetoId?: string | null },
  montar: (dia: string, hora: string) => string
) {
  return {
    cliente_id: ids.clienteId,
    empresa_id: ids.empresaId,
    projeto_id: ids.projetoId ?? null,
    tipo: p.tipo,
    texto: p.texto.trim() || TIPO_ATIVIDADE_LABEL[p.tipo],
    responsavel_id: p.responsavel === SEM_RESPONSAVEL ? null : p.responsavel,
    previsto_para: montar(p.dia, p.hora),
  }
}
