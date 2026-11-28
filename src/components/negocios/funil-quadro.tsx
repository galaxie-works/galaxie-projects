'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KanbanSquareIcon, ListIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarMoeda } from '@/lib/formato'
import { negocioAberto, valorDoNegocio } from '@/lib/negocios'
import { FASE_NEGOCIO_LABEL, FASES_NEGOCIO, type FaseNegocio, type MembroEquipe, type Negocio } from '@/types'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from '@/components/reui/kanban'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CartaoNegocio } from './cartao-negocio'
import type { ClienteOpcao } from './negocio-dialog'
import { useAcoesNegocio } from './negocio-acoes'

type Quadro = Record<FaseNegocio, Negocio[]>

function montarQuadro(negocios: Negocio[]): Quadro {
  const quadro = Object.fromEntries(FASES_NEGOCIO.map((f) => [f, [] as Negocio[]])) as Quadro
  ;[...negocios].sort((a, b) => a.ordem - b.ordem).forEach((n) => quadro[n.fase].push(n))
  return quadro
}

type Props = {
  negocios: Negocio[]
  empresaId: string
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  clientes: ClienteOpcao[]
  agora: number
}

export function FunilQuadro({ negocios, empresaId, equipe, clientes, agora }: Props) {
  const [arrasto, setArrasto] = useState<Quadro | null>(null)
  // Quadro ou lista vem da URL (?vista=lista), para o menu lateral abrir direto.
  const router = useRouter()
  const busca = useSearchParams()
  // Em aberto (padrão), ganhos ou perdidos: vem do menu lateral (?situacao=).
  // Ganhos e perdidos saem do quadro e aparecem só em lista.
  const situacao = busca.get('situacao') === 'ganhos' ? 'ganhos' : busca.get('situacao') === 'perdidos' ? 'perdidos' : 'abertos'
  const visiveis = negocios.filter((n) =>
    situacao === 'ganhos' ? n.fase === 'ganho' : situacao === 'perdidos' ? n.fase === 'perdido' : negocioAberto(n)
  )
  const vista: 'quadro' | 'lista' = situacao !== 'abertos' || busca.get('vista') === 'lista' ? 'lista' : 'quadro'
  const setVista = (v: 'quadro' | 'lista') =>
    router.replace(v === 'lista' ? '/funil?vista=lista' : '/funil', { scroll: false })
  const proximaOrdem = negocios.reduce((max, n) => Math.max(max, n.ordem + 1), 0)
  const { acoes, dialogos } = useAcoesNegocio({ empresaId, equipe, clientes, proximaOrdem })

  const quadro = arrasto ?? montarQuadro(visiveis)

  async function soltar(final: Quadro, de: string, para: string) {
    setArrasto(null)
    const fase = para as FaseNegocio
    // O cartão que mudou de coluna ainda carrega a fase antiga.
    const movido = FASES_NEGOCIO.flatMap((f) => final[f].filter((n) => n.fase !== f))[0]

    if (movido && de !== para) {
      // Negócio ganho já virou obra: não volta para o funil.
      if (movido.fase === 'ganho') {
        toast.info('Este negócio já virou obra', { description: 'Abra a obra para acompanhar.' })
        return
      }
      // Ganho e perdido têm regra própria (obra e motivo de perda).
      if (fase === 'ganho') return void acoes.ganhar(movido)
      if (fase === 'perdido') return acoes.perder(movido)
      const posicao = final[fase].findIndex((n) => n.id === movido.id)
      return void acoes.mover(movido, fase, posicao)
    }

    // Só reordenou dentro da coluna: grava a nova ordem.
    const coluna = final[fase]
    const alteradas = coluna.filter((n, i) => n.ordem !== i)
    if (alteradas.length === 0) return
    const supabase = createClient()
    const resultados = await Promise.all(
      coluna.map((n, i) => (n.ordem !== i ? supabase.from('negocios').update({ ordem: i }).eq('id', n.id) : null))
    )
    const falha = resultados.find((r) => r?.error)
    if (falha?.error) toast.error('Não foi possível reordenar', { description: falha.error.message })
  }

  const totalColuna = (f: FaseNegocio) => quadro[f].reduce((s, n) => s + valorDoNegocio(n), 0)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {situacao === 'abertos' ? (
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[vista]}
          onValueChange={(v) => v[0] && setVista(v[0] as 'quadro' | 'lista')}
          aria-label="Ver como"
        >
          <ToggleGroupItem value="quadro">
            <KanbanSquareIcon />
            Quadro
          </ToggleGroupItem>
          <ToggleGroupItem value="lista">
            <ListIcon />
            Lista
          </ToggleGroupItem>
        </ToggleGroup>
        ) : (
          <span className="text-sm text-muted-foreground">
            {situacao === 'ganhos' ? 'Negócios ganhos, que já viraram obra' : 'Negócios perdidos e o motivo'}
          </span>
        )}
        <Button type="button" onClick={() => acoes.novo()}>
          <PlusIcon data-icon="inline-start" />
          Novo negócio
        </Button>
      </div>

      {vista === 'lista' ? (
        <Frame spacing="default" className="min-w-0">
          {FASES_NEGOCIO.filter((f) => quadro[f].length > 0).map((f) => (
            <FramePanel key={f} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {FASE_NEGOCIO_LABEL[f]}{' '}
                  <span className="text-xs text-muted-foreground tabular-nums">{quadro[f].length}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatarMoeda(totalColuna(f))}</span>
              </div>
              <ItemGroup className="gap-2">
                {quadro[f].map((n) => (
                  <CartaoNegocio key={n.id} negocio={n} acoes={acoes} agora={agora} />
                ))}
              </ItemGroup>
            </FramePanel>
          ))}
          {visiveis.length === 0 && (
            <FramePanel>
              <Empty>
                <EmptyHeader>
                  <EmptyDescription>
                    {situacao === 'ganhos'
                      ? 'Nenhum negócio ganho ainda.'
                      : situacao === 'perdidos'
                        ? 'Nenhum negócio perdido.'
                        : 'Nenhum negócio em aberto.'}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </FramePanel>
          )}
        </Frame>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          <Kanban
            value={quadro}
            onValueChange={(v) => setArrasto(v as Quadro)}
            onValueCommit={(v, meta) => soltar(v as Quadro, meta.activeContainer, meta.overContainer)}
            onDragCancel={() => setArrasto(null)}
            restoreOnCancel
            getItemValue={(n: Negocio) => n.id}
          >
            <KanbanBoard className="flex w-max gap-3 sm:grid-cols-none">
              {FASES_NEGOCIO.map((fase) => (
                <KanbanColumn key={fase} value={fase} className="w-72 shrink-0">
                  <Frame spacing="sm" className="h-full">
                    <FrameHeader className="flex flex-row items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FrameTitle className="truncate">{FASE_NEGOCIO_LABEL[fase]}</FrameTitle>
                        <Badge variant="outline" className="tabular-nums">
                          {quadro[fase].length}
                        </Badge>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatarMoeda(totalColuna(fase))}
                      </span>
                    </FrameHeader>
                    <FramePanel>
                      <KanbanColumnContent value={fase} className="flex min-h-24 flex-col gap-2">
                        {quadro[fase].length === 0 && (
                          <Empty className="border">
                            <EmptyHeader>
                              <EmptyDescription>Arraste um negócio para cá</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        )}
                        {quadro[fase].map((n) => (
                          <KanbanItem key={n.id} value={n.id}>
                            <KanbanItemHandle>
                              <CartaoNegocio negocio={n} acoes={acoes} agora={agora} />
                            </KanbanItemHandle>
                          </KanbanItem>
                        ))}
                      </KanbanColumnContent>
                    </FramePanel>
                  </Frame>
                </KanbanColumn>
              ))}
            </KanbanBoard>
            <KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
          </Kanban>
        </div>
      )}
      {dialogos}
    </div>
  )
}
