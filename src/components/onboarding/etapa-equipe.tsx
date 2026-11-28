'use client'

import { PlusIcon, Trash2Icon, UserRoundIcon, UsersIcon } from 'lucide-react'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Membro, ModoTrabalho, Rascunho } from './rascunho'

type Props = {
  rascunho: Rascunho
  atualizar: (patch: Partial<Rascunho>) => void
}

function novoMembro(): Membro {
  return { id: crypto.randomUUID(), nome: '', funcao: '' }
}

export function EtapaEquipe({ rascunho, atualizar }: Props) {
  const { modo, equipe } = rascunho

  function escolherModo(valor: ModoTrabalho) {
    atualizar({
      modo: valor,
      equipe: valor === 'equipe' && equipe.length === 0 ? [novoMembro()] : equipe,
    })
  }

  function editarMembro(id: string, patch: Partial<Membro>) {
    atualizar({ equipe: equipe.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel id="modo-label">Você trabalha</FieldLabel>
        <ToggleGroup
          variant="outline"
          value={[modo]}
          onValueChange={(v) => {
            const escolhido = v[0] as ModoTrabalho | undefined
            if (escolhido) escolherModo(escolhido)
          }}
          aria-labelledby="modo-label"
          className="w-full"
        >
          <ToggleGroupItem value="sozinho" className="flex-1">
            <UserRoundIcon />
            Sozinho
          </ToggleGroupItem>
          <ToggleGroupItem value="equipe" className="flex-1">
            <UsersIcon />
            Com equipe
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {modo === 'equipe' && (
        <FieldSet>
          <FieldLegend variant="label">Quem trabalha com você</FieldLegend>
          <FieldDescription>Nome e função de cada pessoa</FieldDescription>
          <ul className="flex flex-col gap-2">
            {equipe.map((m, i) => (
              <li key={m.id} className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={m.nome}
                    onChange={(e) => editarMembro(m.id, { nome: e.target.value })}
                    placeholder="Nome"
                    aria-label={`Nome da pessoa ${i + 1}`}
                  />
                  <Input
                    value={m.funcao}
                    onChange={(e) => editarMembro(m.id, { funcao: e.target.value })}
                    placeholder="Função, ex.: pedreiro"
                    aria-label={`Função da pessoa ${i + 1}`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover pessoa ${i + 1}`}
                  onClick={() => atualizar({ equipe: equipe.filter((x) => x.id !== m.id) })}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => atualizar({ equipe: [...equipe, novoMembro()] })}
            >
              <PlusIcon data-icon="inline-start" />
              Adicionar pessoa
            </Button>
          </div>
        </FieldSet>
      )}

      <Field>
        <FieldLabel htmlFor="processo">Como você conduz uma obra</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id="processo"
            value={rascunho.processo}
            onChange={(e) => atualizar({ processo: e.target.value })}
            placeholder="Ex.: Faço a visita técnica, meço, mando o orçamento em até 2 dias, combino a entrada e começo pela demolição."
            rows={4}
          />
          <InputGroupAddon align="block-end">
            <InputGroupText className="text-xs font-normal">
              Opcional
            </InputGroupText>
            <span className="ml-auto">
              <BotaoVoz
                rotulo="Ditar processo"
                size="icon-xs"
                onFinal={(t) =>
                  atualizar({
                    processo: rascunho.processo ? `${rascunho.processo.trimEnd()} ${t}` : t,
                  })
                }
              />
            </span>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>Do primeiro contato à entrega: visita, orçamento, execução.</FieldDescription>
      </Field>
    </FieldGroup>
  )
}
