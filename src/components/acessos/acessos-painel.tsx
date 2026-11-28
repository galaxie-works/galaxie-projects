'use client'

import { useState, useTransition } from 'react'
import { MailIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import {
  AlertDialog,
  AlertDialogAction,
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { iniciais } from '@/lib/formato'
import { MODULOS, ROTULO_NIVEL, ROTULO_PAPEL } from '@/lib/acesso-regras'
import { reenviarConviteAcao, removerAcessoAcao } from '@/app/(dashboard)/acessos/actions'
import { AcessoDialog, type MembroAcesso } from './acesso-dialog'

export type LinhaAcesso = MembroAcesso & {
  nome: string | null
  fotoUrl: string | null
  equipeNome: string | null
}

const STATUS: Record<MembroAcesso['status'], { rotulo: string; variante: 'success-light' | 'warning-light' | 'destructive-light' }> = {
  ativo: { rotulo: 'Ativo', variante: 'success-light' },
  convidado: { rotulo: 'Convite enviado', variante: 'warning-light' },
  suspenso: { rotulo: 'Suspenso', variante: 'destructive-light' },
}

function resumoPermissoes(m: LinhaAcesso): string {
  if (m.papel !== 'membro') return m.papel === 'dono' ? 'Pode tudo' : 'Tudo, menos assinatura e acessos'
  const partes = MODULOS.filter((x) => (m.permissoes[x.id] ?? 'nenhum') !== 'nenhum').map(
    (x) => `${x.rotulo} (${ROTULO_NIVEL[m.permissoes[x.id]!].toLowerCase()})`
  )
  return partes.length ? partes.join(', ') : 'Nenhum módulo liberado'
}

export function AcessosPainel({
  membros,
  equipe,
  uso,
}: {
  membros: LinhaAcesso[]
  equipe: { id: string; nome: string }[]
  /** Logins usados e inclusos no plano (null = ilimitado). */
  uso: { escritorio: [number, number | null]; campo: [number, number | null]; plano: string }
}) {
  const [convidando, setConvidando] = useState(false)
  const [editando, setEditando] = useState<LinhaAcesso | null>(null)
  const [removendo, setRemovendo] = useState<LinhaAcesso | null>(null)
  const [pendente, iniciar] = useTransition()

  const limite = (n: number | null) => (n == null ? 'ilimitado' : String(n))

  return (
    <>
      <Frame spacing="default">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Pessoas com acesso</FrameTitle>
            <FrameDescription>
              Plano {uso.plano}: escritório {uso.escritorio[0]} de {limite(uso.escritorio[1])} · campo {uso.campo[0]} de{' '}
              {limite(uso.campo[1])}
            </FrameDescription>
          </div>
          <Button onClick={() => setConvidando(true)}>
            <UserPlusIcon data-icon="inline-start" />
            Convidar
          </Button>
        </FrameHeader>
        <FramePanel>
          {membros.length <= 1 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Só você por enquanto</EmptyTitle>
                <EmptyDescription>
                  Convide quem trabalha com você e escolha o que cada um vê e edita.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          <ItemGroup className="gap-1">
            {membros.map((m) => (
              <Item key={m.id} size="sm">
                <ItemMedia>
                  <Avatar className="size-9">
                    {m.fotoUrl && <AvatarImage src={m.fotoUrl} alt="" />}
                    <AvatarFallback>{iniciais(m.nome || m.email) || '?'}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full min-w-0 flex-wrap">
                    <span className="truncate">{m.nome || m.email}</span>
                    <Badge variant={m.papel === 'membro' ? 'info-light' : 'primary-light'}>{ROTULO_PAPEL[m.papel]}</Badge>
                    {m.papel !== 'dono' && <Badge variant={STATUS[m.status].variante}>{STATUS[m.status].rotulo}</Badge>}
                  </ItemTitle>
                  <ItemDescription className="text-xs">
                    {m.nome ? `${m.email} · ` : ''}
                    {m.equipeNome ? `${m.equipeNome} na equipe · ` : ''}
                    {resumoPermissoes(m)}
                  </ItemDescription>
                </ItemContent>
                {m.papel !== 'dono' && (
                  <ItemActions>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${m.email}`} />}
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => setEditando(m)}>
                            <PencilIcon />
                            Mudar acesso
                          </DropdownMenuItem>
                          {m.status === 'convidado' && (
                            <DropdownMenuItem
                              disabled={pendente}
                              onClick={() =>
                                iniciar(async () => {
                                  const r = await reenviarConviteAcao(m.id)
                                  if (r.ok) toast.success(r.mensagem)
                                  else toast.error(r.erro)
                                })
                              }
                            >
                              <MailIcon />
                              Reenviar convite
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setRemovendo(m)}>
                          <Trash2Icon />
                          Tirar acesso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ItemActions>
                )}
              </Item>
            ))}
          </ItemGroup>
        </FramePanel>
      </Frame>

      {convidando && <AcessoDialog aberto onOpenChange={setConvidando} equipe={equipe} />}
      {editando && (
        <AcessoDialog
          key={editando.id}
          aberto
          onOpenChange={(v) => !v && setEditando(null)}
          membro={editando}
          equipe={equipe}
        />
      )}

      <AlertDialog open={!!removendo} onOpenChange={(v) => !v && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar o acesso de {removendo?.nome || removendo?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa deixa de entrar na sua empresa. O que ela cadastrou continua no app. Para só pausar, use
              Mudar acesso e suspenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const alvo = removendo
                if (!alvo) return
                iniciar(async () => {
                  const r = await removerAcessoAcao(alvo.id)
                  if (r.ok) toast.success(r.mensagem)
                  else toast.error(r.erro)
                  setRemovendo(null)
                })
              }}
            >
              Tirar acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
