'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarIcon, EllipsisIcon, ListChecksIcon, PencilIcon, PlusIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatarData } from '@/lib/formato'
import { STATUS_ETAPA_LABEL, type Etapa, type MembroEquipe, type StatusEtapa } from '@/types'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { EtapaDialog } from '@/components/projetos/etapa-dialog'

const COLUNAS: StatusEtapa[] = ['pendente', 'em_andamento', 'concluida']

type Quadro = Record<StatusEtapa, Etapa[]>

function montarQuadro(etapas: Etapa[]): Quadro {
  const quadro: Quadro = { pendente: [], em_andamento: [], concluida: [] }
  ;[...etapas].sort((a, b) => a.ordem - b.ordem).forEach((e) => quadro[e.status].push(e))
  return quadro
}

// Achata o quadro de volta numa lista: status = coluna, ordem = posição global.
function achatarQuadro(quadro: Quadro): Etapa[] {
  let ordem = 0
  return COLUNAS.flatMap((status) => quadro[status].map((e) => ({ ...e, status, ordem: ordem++ })))
}

type Props = {
  projetoId: string
  etapas: Etapa[]
  onEtapasChange: (etapas: Etapa[]) => void
  equipe: MembroEquipe[]
  hoje: string
}

export function EtapasQuadro({ projetoId, etapas, onEtapasChange, equipe, hoje }: Props) {
  const router = useRouter()
  // Durante o arrasto o quadro vive aqui; ao soltar, vira lista e é salvo.
  const [arrasto, setArrasto] = useState<Quadro | null>(null)
  const [dialogo, setDialogo] = useState<{ etapa?: Etapa; status?: StatusEtapa } | null>(null)
  const [excluir, setExcluir] = useState<Etapa | null>(null)

  const quadro = arrasto ?? montarQuadro(etapas)

  async function persistirMovimento(final: Quadro) {
    setArrasto(null)
    const anteriores = new Map(etapas.map((e) => [e.id, e]))
    const nova = achatarQuadro(final)
    const alteradas = nova.filter((e) => {
      const antes = anteriores.get(e.id)
      return !antes || antes.status !== e.status || antes.ordem !== e.ordem
    })
    if (alteradas.length === 0) return
    onEtapasChange(nova)

    const supabase = createClient()
    const resultados = await Promise.all(
      alteradas.map((e) =>
        supabase.from('etapas').update({ status: e.status, ordem: e.ordem }).eq('id', e.id)
      )
    )
    const falha = resultados.find((r) => r.error)
    if (falha) {
      onEtapasChange(etapas)
      toast.error('Não foi possível mover a etapa', { description: falha.error?.message })
      return
    }
    const movida = alteradas.find((e) => anteriores.get(e.id)?.status !== e.status)
    if (movida) toast.success(`${movida.nome}: ${STATUS_ETAPA_LABEL[movida.status]}`)
    router.refresh()
  }

  function aoSalvar(salva: Etapa) {
    const existe = etapas.some((e) => e.id === salva.id)
    onEtapasChange(existe ? etapas.map((e) => (e.id === salva.id ? salva : e)) : [...etapas, salva])
    router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return false
    const { error } = await createClient().from('etapas').delete().eq('id', excluir.id)
    if (error) {
      toast.error('Não foi possível excluir a etapa', { description: error.message })
      return false
    }
    onEtapasChange(etapas.filter((e) => e.id !== excluir.id))
    toast.success('Etapa excluída')
    router.refresh()
    return true
  }

  const proximaOrdem = etapas.reduce((max, e) => Math.max(max, e.ordem + 1), 0)

  const dialogos = (
    <>
      <EtapaDialog
        aberto={dialogo !== null}
        onOpenChange={(v) => !v && setDialogo(null)}
        projetoId={projetoId}
        equipe={equipe}
        etapa={dialogo?.etapa}
        statusInicial={dialogo?.status}
        ordem={proximaOrdem}
        onSalva={aoSalvar}
      />
      <ConfirmarExclusao
        aberto={excluir !== null}
        onOpenChange={(v) => !v && setExcluir(null)}
        titulo="Excluir esta etapa?"
        descricao={excluir ? `“${excluir.nome}” sai do quadro da obra.` : ''}
        rotulo="Excluir etapa"
        onConfirmar={confirmarExclusao}
      />
    </>
  )

  if (etapas.length === 0) {
    return (
      <Frame spacing="default">
        <FramePanel>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecksIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma etapa ainda</EmptyTitle>
              <EmptyDescription>Divida a obra em etapas e arraste conforme avança.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setDialogo({ status: 'pendente' })}>
                <PlusIcon data-icon="inline-start" />
                Adicionar etapa
              </Button>
            </EmptyContent>
          </Empty>
        </FramePanel>
        {dialogos}
      </Frame>
    )
  }

  return (
    <>
      <Kanban
        value={quadro}
        onValueChange={(v) => setArrasto(v as Quadro)}
        onValueCommit={(v) => persistirMovimento(v as Quadro)}
        onDragCancel={() => setArrasto(null)}
        restoreOnCancel
        getItemValue={(e: Etapa) => e.id}
      >
        <KanbanBoard>
          {COLUNAS.map((status) => (
            <KanbanColumn key={status} value={status} className="min-w-0">
              <Frame spacing="sm" className="h-full">
                <FrameHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FrameTitle>{STATUS_ETAPA_LABEL[status]}</FrameTitle>
                    <Badge variant="outline" className="tabular-nums">
                      {quadro[status].length}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Adicionar etapa em ${STATUS_ETAPA_LABEL[status]}`}
                    onClick={() => setDialogo({ status })}
                  >
                    <PlusIcon />
                  </Button>
                </FrameHeader>
                <FramePanel>
                  <KanbanColumnContent value={status} className="flex min-h-24 flex-col gap-2">
                    {quadro[status].length === 0 && (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        Arraste uma etapa para cá
                      </p>
                    )}
                    {quadro[status].map((etapa) => (
                      <CartaoEtapa
                        key={etapa.id}
                        etapa={etapa}
                        hoje={hoje}
                        onEditar={() => setDialogo({ etapa })}
                        onExcluir={() => setExcluir(etapa)}
                      />
                    ))}
                  </KanbanColumnContent>
                </FramePanel>
              </Frame>
            </KanbanColumn>
          ))}
        </KanbanBoard>
        <KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
      </Kanban>
      {dialogos}
    </>
  )
}

function CartaoEtapa({
  etapa,
  hoje,
  onEditar,
  onExcluir,
}: {
  etapa: Etapa
  hoje: string
  onEditar: () => void
  onExcluir: () => void
}) {
  const atrasada =
    etapa.status !== 'concluida' && etapa.data_prazo !== null && etapa.data_prazo.slice(0, 10) < hoje

  return (
    <KanbanItem value={etapa.id}>
      <KanbanItemHandle>
        <Item variant="outline" size="sm" className="bg-background">
          <ItemContent className="min-w-0">
            <ItemTitle className="line-clamp-2">{etapa.nome}</ItemTitle>
            <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="flex items-center gap-1">
                <UserIcon aria-hidden className="size-3" />
                {etapa.equipe?.nome ?? 'Sem responsável'}
              </span>
              {etapa.data_prazo && (
                <span
                  className={
                    atrasada
                      ? 'flex items-center gap-1 font-medium text-destructive tabular-nums'
                      : 'flex items-center gap-1 tabular-nums'
                  }
                >
                  <CalendarIcon aria-hidden className="size-3" />
                  {formatarData(etapa.data_prazo)}
                </span>
              )}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Ações da etapa ${etapa.nome}`}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                }
              >
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditar}>
                  <PencilIcon />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onExcluir}>
                  <Trash2Icon />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ItemActions>
        </Item>
      </KanbanItemHandle>
    </KanbanItem>
  )
}
