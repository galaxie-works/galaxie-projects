'use client'

import { AREAS_SERVICO } from '@/lib/servicos'
import { IconTile } from '@/components/reui/icon-tile'
import { iconeDaArea } from '@/components/servicos/icones-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import type { Rascunho } from './rascunho'

type Props = {
  rascunho: Rascunho
  atualizar: (patch: Partial<Rascunho>) => void
  mostrarErros: boolean
}

const TOTAL_POR_AREA = Object.fromEntries(
  AREAS_SERVICO.map((a) => [a.id, a.categorias.reduce((n, c) => n + c.servicos.length, 0)])
)

export function EtapaAreas({ rascunho, atualizar, mostrarErros }: Props) {
  function alternar(id: string, marcado: boolean) {
    atualizar({
      areas: marcado
        ? [...rascunho.areas.filter((a) => a !== id), id]
        : rascunho.areas.filter((a) => a !== id),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Áreas de atuação">
        {AREAS_SERVICO.map((area) => {
          const Icone = iconeDaArea(area.id)
          const idCampo = `area-${area.id}`
          return (
            <FieldLabel key={area.id} htmlFor={idCampo}>
              <Field orientation="horizontal">
                <IconTile aria-hidden="true">
                  <Icone />
                </IconTile>
                <FieldContent>
                  <FieldTitle>{area.nome}</FieldTitle>
                  <FieldDescription className="text-xs">
                    {area.descricao}
                    <span className="sr-only">,</span>
                    <span className="block tabular-nums">
                      {TOTAL_POR_AREA[area.id]} serviços
                    </span>
                  </FieldDescription>
                </FieldContent>
                <Checkbox
                  id={idCampo}
                  checked={rascunho.areas.includes(area.id)}
                  onCheckedChange={(c) => alternar(area.id, c === true)}
                />
              </Field>
            </FieldLabel>
          )
        })}
      </div>
      {mostrarErros && rascunho.areas.length === 0 && (
        <FieldError>Escolha pelo menos uma área.</FieldError>
      )}
    </div>
  )
}
