'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRoundIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarTelefone } from '@/components/clientes/telefone'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { iniciais } from '@/lib/formato'
import { BUCKET_FOTOS } from '@/lib/equipe'
import type { MembroEquipe } from '@/types'

export function EquipeManager({
  equipeInicial,
  fotos,
  podeDarAcesso = false,
}: {
  equipeInicial: MembroEquipe[]
  fotos: Record<string, string>
  /** Dono: mostra o atalho para os acessos ao app. */
  podeDarAcesso?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [equipe, setEquipe] = useState(equipeInicial)
  const [removendo, setRemovendo] = useState<MembroEquipe | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  async function confirmarRemocao() {
    if (!removendo) return
    setExcluindo(true)
    const { error } = await supabase.from('equipe').delete().eq('id', removendo.id)
    setExcluindo(false)
    if (error) {
      toast.error('Não foi possível remover', { description: error.message })
      return
    }
    if (removendo.foto_caminho) await supabase.storage.from(BUCKET_FOTOS).remove([removendo.foto_caminho])
    setEquipe((e) => e.filter((m) => m.id !== removendo.id))
    toast.success(`${removendo.nome} saiu da equipe`)
    setRemovendo(null)
    router.refresh()
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground text-sm">
            Pessoas que você escala como responsáveis nas etapas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeDarAcesso && (
            <Button variant="outline" nativeButton={false} render={<Link href="/acessos" />}>
              <KeyRoundIcon data-icon="inline-start" />
              Acessos ao app
            </Button>
          )}
          <Button nativeButton={false} render={<Link href="/equipe/novo" />}>
            <PlusIcon data-icon="inline-start" />
            Adicionar pessoa
          </Button>
        </div>
      </header>

      <Frame spacing="default">
        <FrameHeader>
          <FrameTitle>Pessoas</FrameTitle>
          <FrameDescription>
            {equipe.length === 0
              ? 'Você está trabalhando sozinho'
              : equipe.length === 1
                ? '1 pessoa na equipe'
                : `${equipe.length} pessoas na equipe`}
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          {equipe.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma pessoa cadastrada</EmptyTitle>
                <EmptyDescription>
                  Adicione quem trabalha com você para atribuir etapas e compras.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button nativeButton={false} render={<Link href="/equipe/novo" />}>
                  <PlusIcon data-icon="inline-start" />
                  Adicionar pessoa
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup>
              {equipe.map((m) => {
                const detalhes = [
                  m.funcao,
                  formatarTelefone(m.telefone || m.telefone_pessoal),
                  [m.cidade, m.uf].filter(Boolean).join(' / '),
                ].filter(Boolean) as string[]
                return (
                  <Item key={m.id} className="hover:bg-muted/50 relative transition-colors">
                    <ItemMedia>
                      <Avatar size="lg">
                        {fotos[m.id] && <AvatarImage src={fotos[m.id]} alt="" />}
                        <AvatarFallback>{iniciais(m.nome)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="truncate">
                        <Link href={`/equipe/${m.id}`} className="after:absolute after:inset-0">
                          {m.nome}
                        </Link>
                      </ItemTitle>
                      {detalhes.length > 0 && (
                        <ItemDescription className="flex flex-wrap items-center gap-2">
                          {detalhes.map((d, i) => (
                            <span key={i} className="flex min-w-0 items-center gap-2">
                              {i > 0 && (
                                <span aria-hidden className="bg-muted-foreground/40 size-1 shrink-0 rounded-full" />
                              )}
                              <span className="truncate tabular-nums">{d}</span>
                            </span>
                          ))}
                        </ItemDescription>
                      )}
                    </ItemContent>
                    <ItemActions className="relative z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Ações para ${m.nome}`}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/equipe/${m.id}`)}>
                            <PencilIcon />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setRemovendo(m)}>
                            <Trash2Icon />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          )}
        </FramePanel>
      </Frame>

      <AlertDialog
        open={removendo !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setRemovendo(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removendo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              As etapas e compras dessa pessoa ficam sem responsável.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmarRemocao} disabled={excluindo}>
              {excluindo && <Spinner data-icon="inline-start" />}
              Remover
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
