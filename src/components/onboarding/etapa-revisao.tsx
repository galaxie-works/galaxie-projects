'use client'

import { useState } from 'react'
import { MicIcon, PencilIcon, SquareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AREAS_SERVICO, SERVICOS_POR_ID, aplicarComandoDeVoz } from '@/lib/servicos'
import { useDitado } from '@/hooks/use-ditado'
import { Badge } from '@/components/reui/badge'
import { nomesDosServicos } from '@/components/servicos/servicos-picker'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { membrosValidos, servicosEfetivos, type Rascunho } from './rascunho'

type Props = {
  rascunho: Rascunho
  atualizar: (patch: Partial<Rascunho>) => void
  irPara: (etapa: number) => void
}

const MAX_BADGES = 12

export function EtapaRevisao({ rascunho, atualizar, irPara }: Props) {
  const [comando, setComando] = useState('')
  const servicos = servicosEfetivos(rascunho)
  const membros = membrosValidos(rascunho)
  const nomesAreas = AREAS_SERVICO.filter((a) => rascunho.areas.includes(a.id)).map((a) => a.nome)

  function aplicar(texto: string) {
    const frase = texto.trim()
    if (!frase) return
    const { selecionados, adicionados, removidos } = aplicarComandoDeVoz(servicos, frase)
    if (adicionados.length === 0 && removidos.length === 0) {
      toast('Nada mudou', { description: `Não achei serviços para mudar em “${frase}”.` })
      return
    }
    // Serviço novo de uma área não marcada: marca a área também.
    const areasNovas = adicionados
      .map((id) => SERVICOS_POR_ID[id]?.area.id)
      .filter((a): a is string => !!a && !rascunho.areas.includes(a))
    atualizar({
      servicos: selecionados,
      areas: [...rascunho.areas, ...new Set(areasNovas)],
    })
    setComando('')
    const partes = [
      adicionados.length > 0 && `Entrou: ${nomesDosServicos(adicionados).join(', ')}`,
      removidos.length > 0 && `Saiu: ${nomesDosServicos(removidos).join(', ')}`,
    ].filter(Boolean)
    toast.success('Serviços ajustados', { description: partes.join('. ') })
  }

  const { suportado, ouvindo, alternar } = useDitado({
    onParcial: setComando,
    onFinal: aplicar,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="ajuste-servicos" className="text-sm font-medium">
          Falar para ajustar
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            aplicar(comando)
          }}
        >
          <InputGroup>
            <InputGroupInput
              id="ajuste-servicos"
              value={comando}
              onChange={(e) => setComando(e.target.value)}
              placeholder="Ex.: tira granilite e coloca pintura externa"
            />
            <InputGroupAddon align="inline-end">
              {suportado && (
                <InputGroupButton
                  size="icon-xs"
                  variant={ouvindo ? 'default' : 'ghost'}
                  onClick={alternar}
                  aria-pressed={ouvindo}
                  aria-label={ouvindo ? 'Parar de ouvir' : 'Falar para ajustar'}
                >
                  {ouvindo ? <SquareIcon /> : <MicIcon />}
                </InputGroupButton>
              )}
              <InputGroupButton type="submit" variant="secondary" disabled={!comando.trim()}>
                Aplicar
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <FieldDescription className="text-xs" role="status" aria-live="polite">
          {ouvindo ? 'Ouvindo…' : 'Fale ou escreva o que entra e o que sai da sua lista de serviços.'}
        </FieldDescription>
      </div>

      <ItemGroup className="gap-2">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Empresa</ItemTitle>
            <ItemDescription>
              {rascunho.nome}
              {rascunho.cnpj && (
                <>
                  <span
                    aria-hidden="true"
                    className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle"
                  />
                  <span className="tabular-nums">CNPJ {rascunho.cnpj}</span>
                </>
              )}
            </ItemDescription>
            {rascunho.descricao && <ItemDescription>{rascunho.descricao}</ItemDescription>}
          </ItemContent>
          <BotaoEditar rotulo="Editar empresa" onClick={() => irPara(1)} />
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Áreas de atuação</ItemTitle>
            <ItemDescription>{nomesAreas.join(', ')}</ItemDescription>
          </ItemContent>
          <BotaoEditar rotulo="Editar áreas" onClick={() => irPara(2)} />
        </Item>

        <Item variant="outline">
          <ItemContent className="gap-2">
            <ItemTitle>
              Serviços
              <Badge variant="outline" className="tabular-nums">
                {servicos.length}
              </Badge>
            </ItemTitle>
            <ul className="flex flex-wrap gap-1.5" aria-label="Serviços">
              {servicos.slice(0, MAX_BADGES).map((id) => (
                <li key={id}>
                  <Badge variant="outline">{SERVICOS_POR_ID[id]?.servico.nome}</Badge>
                </li>
              ))}
              {servicos.length > MAX_BADGES && (
                <li>
                  <Badge variant="outline" className="tabular-nums text-muted-foreground">
                    +{servicos.length - MAX_BADGES}
                  </Badge>
                </li>
              )}
            </ul>
          </ItemContent>
          <BotaoEditar rotulo="Editar serviços" onClick={() => irPara(3)} />
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Como você trabalha</ItemTitle>
            <ItemDescription>
              {membros.length === 0
                ? 'Sozinho'
                : `Com equipe: ${membros
                    .map((m) => (m.funcao ? `${m.nome} (${m.funcao})` : m.nome))
                    .join(', ')}`}
            </ItemDescription>
            {rascunho.processo.trim() && (
              <ItemDescription>{rascunho.processo.trim()}</ItemDescription>
            )}
          </ItemContent>
          <BotaoEditar rotulo="Editar como você trabalha" onClick={() => irPara(4)} />
        </Item>
      </ItemGroup>
    </div>
  )
}

function BotaoEditar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <ItemActions className="self-start">
      <Button type="button" variant="ghost" size="sm" onClick={onClick} aria-label={rotulo}>
        <PencilIcon data-icon="inline-start" />
        Editar
      </Button>
    </ItemActions>
  )
}
