'use client'

import { Fragment } from 'react'
import { CheckIcon } from 'lucide-react'
import type { PerguntaAssistente } from '@/lib/ia/protocolo'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'

type Props = {
  pergunta: PerguntaAssistente
  escolhida?: number
  /** Sem onEscolher (pergunta antiga ou já respondida), o cartão só mostra. */
  onEscolher?: (indice: number) => void
}

// Pergunta com opções clicáveis, uma por vez, como no app do Claude.
// Respondida, encolhe para a opção escolhida com um check.
export function CartaoPergunta({ pergunta, escolhida, onEscolher }: Props) {
  const respondida = escolhida !== undefined
  const opcoes = pergunta.opcoes
    .map((o, i) => ({ ...o, i }))
    .filter((o) => !respondida || o.i === escolhida)

  return (
    <Frame spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle className={respondida ? 'font-normal text-muted-foreground' : 'text-base tracking-tight'}>
          {pergunta.pergunta}
        </FrameTitle>
      </FrameHeader>
      <FramePanel className="p-1">
        <ItemGroup role="radiogroup" aria-label={pergunta.pergunta} className="gap-0">
          {opcoes.map((o, n) => {
            const marcada = o.i === escolhida
            const ativo = !!onEscolher && !respondida
            return (
              <Fragment key={o.i}>
                {n > 0 && <ItemSeparator className="my-1" />}
                <Item
                  role="radio"
                  aria-checked={marcada}
                  aria-disabled={!ativo || undefined}
                  className={ativo ? 'cursor-pointer hover:bg-muted' : undefined}
                  render={<button type="button" disabled={!ativo && !marcada} />}
                  onClick={ativo ? () => onEscolher(o.i) : undefined}
                >
                  <ItemContent>
                    <ItemTitle>
                      {o.rotulo}
                      {o.recomendada && !respondida && (
                        <Badge variant="primary-light">
                          Recomendado
                        </Badge>
                      )}
                    </ItemTitle>
                    {o.descricao && <ItemDescription className="line-clamp-none">{o.descricao}</ItemDescription>}
                  </ItemContent>
                  {marcada && (
                    <ItemActions>
                      <CheckIcon className="size-4" aria-hidden />
                    </ItemActions>
                  )}
                </Item>
              </Fragment>
            )
          })}
        </ItemGroup>
      </FramePanel>
    </Frame>
  )
}
