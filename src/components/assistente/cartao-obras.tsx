'use client'

import Link from 'next/link'
import { ArrowRightIcon, CircleDotIcon } from 'lucide-react'
import type { CartaoObras, ObraResumo } from '@/lib/ia/protocolo'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { formatarData } from '@/lib/formato'
import { Fragment } from 'react'

// Obras com progresso por etapas, em cores: verde concluídas, amarelo em
// andamento, cinza faltando. Embaixo, a próxima etapa. Toque abre a obra.

function BarraEtapas({ obra }: { obra: ObraResumo }) {
  const { concluidas, andamento, pendentes } = obra.etapas
  const total = concluidas + andamento + pendentes
  const partes = total
    ? [
        { n: concluidas, cor: 'bg-success' },
        { n: andamento, cor: 'bg-warning' },
      ]
    : [{ n: obra.percentual, cor: 'bg-success' }]
  const base = total || 100
  const resumo = total
    ? `${concluidas} de ${total} etapas concluídas, ${andamento} em andamento, ${pendentes} faltando`
    : `${obra.percentual}% concluído`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          role="img"
          aria-label={resumo}
          className="flex h-2 min-w-0 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {partes.map((p, i) =>
            p.n > 0 ? <span key={i} className={p.cor} style={{ width: `${(p.n / base) * 100}%` }} /> : null,
          )}
        </div>
        <span className="w-9 shrink-0 text-end text-xs font-medium tabular-nums">{obra.percentual}%</span>
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          <Legenda cor="bg-success" texto={`${concluidas} concluída${concluidas === 1 ? '' : 's'}`} />
          {andamento > 0 && <Legenda cor="bg-warning" texto={`${andamento} em andamento`} />}
          {pendentes > 0 && <Legenda cor="bg-muted-foreground/30" texto={`${pendentes} faltando`} />}
        </div>
      )}
    </div>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${cor}`} />
      {texto}
    </span>
  )
}

export function CartaoObrasView({ cartao, onAbrir }: { cartao: CartaoObras; onAbrir?: () => void }) {
  return (
    <Frame spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle className="text-base tracking-tight">{cartao.titulo}</FrameTitle>
        <FrameDescription>
          {cartao.obras.length === 0
            ? 'Nenhuma obra encontrada.'
            : `${cartao.obras.length + cartao.restantes} obra${cartao.obras.length + cartao.restantes === 1 ? '' : 's'}` +
              (cartao.restantes ? `, mostrando as ${cartao.obras.length} com prazo mais próximo` : '')}
        </FrameDescription>
      </FrameHeader>
      {cartao.obras.length > 0 && (
        <FramePanel className="p-1">
          <ItemGroup className="gap-0">
            {cartao.obras.map((o, n) => (
              <Fragment key={o.id}>
                {n > 0 && <ItemSeparator className="my-1" />}
                <Item
                  className="flex-col items-stretch gap-3 hover:bg-muted"
                  render={<Link href={`/projetos/${o.id}`} onClick={onAbrir} />}
                >
                  <ItemContent className="gap-1">
                    <ItemTitle className="w-full">
                      <span className="truncate">{o.nome}</span>
                      {o.atrasada && <Badge variant="destructive-light">Atrasada</Badge>}
                    </ItemTitle>
                    <ItemDescription>
                      {[o.cliente, o.prazo ? `prazo ${formatarData(o.prazo)}` : null].filter(Boolean).join(' · ')}
                    </ItemDescription>
                  </ItemContent>
                  <BarraEtapas obra={o} />
                  {o.proxima && (
                    <Marker className="text-xs">
                      <MarkerIcon>
                        {o.proxima.emAndamento ? (
                          <CircleDotIcon className="size-3.5 text-warning" />
                        ) : (
                          <ArrowRightIcon className="size-3.5" />
                        )}
                      </MarkerIcon>
                      <MarkerContent>
                        {o.proxima.emAndamento ? 'Em andamento: ' : 'Próxima etapa: '}
                        <span className="font-medium text-foreground">{o.proxima.nome}</span>
                        {o.proxima.prazo ? ` · até ${formatarData(o.proxima.prazo)}` : ''}
                      </MarkerContent>
                    </Marker>
                  )}
                </Item>
              </Fragment>
            ))}
          </ItemGroup>
        </FramePanel>
      )}
    </Frame>
  )
}
