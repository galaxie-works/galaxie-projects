'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CampoComVoz } from '@/components/clientes/campo-com-voz'
import { formatarTelefone, paraE164 } from '@/components/clientes/telefone'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { PhoneInput } from '@/components/reui/phone-input'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
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
import type { MembroEquipe } from '@/types'

type Rascunho = { id: string | null; nome: string; funcao: string; telefone: string }

const VAZIO: Rascunho = { id: null, nome: '', funcao: '', telefone: '' }

function MembroDialog({
  aberto,
  onAbertoChange,
  inicial,
  onSalvar,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  inicial: Rascunho
  onSalvar: (r: Rascunho) => Promise<string | null>
}) {
  const [rascunho, setRascunho] = useState(inicial)
  const [tentou, setTentou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const editando = inicial.id !== null
  const erroNome = tentou && !rascunho.nome.trim() ? 'Informe o nome da pessoa.' : null

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!rascunho.nome.trim()) return
    setSalvando(true)
    setErro(null)
    const falha = await onSalvar(rascunho)
    setSalvando(false)
    if (falha) setErro(falha)
  }

  return (
    <Dialog open={aberto} onOpenChange={(aberto) => !salvando && onAbertoChange(aberto)}>
      <DialogContent>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar pessoa' : 'Adicionar pessoa'}</DialogTitle>
            <DialogDescription>Quem trabalha com você nas obras.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!erroNome || undefined}>
              <FieldLabel htmlFor="membro-nome">Nome</FieldLabel>
              <CampoComVoz
                id="membro-nome"
                value={rascunho.nome}
                onChange={(nome) => setRascunho((r) => ({ ...r, nome }))}
                placeholder="Josué Ferreira"
                invalido={!!erroNome}
                autoFocus
              />
              <FieldError>{erroNome}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="membro-funcao">Função</FieldLabel>
              <CampoComVoz
                id="membro-funcao"
                value={rascunho.funcao}
                onChange={(funcao) => setRascunho((r) => ({ ...r, funcao }))}
                placeholder="Pedreiro, assentador de porcelanato"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="membro-telefone">Telefone</FieldLabel>
              <PhoneInput
                id="membro-telefone"
                defaultCountry="BR"
                value={rascunho.telefone}
                onChange={(telefone) => setRascunho((r) => ({ ...r, telefone: telefone ?? '' }))}
                placeholder="(11) 98765-4321"
              />
            </Field>
            <FieldError>{erro}</FieldError>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={salvando} />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={salvando}>
              {salvando && <Spinner data-icon="inline-start" />}
              {editando ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EquipeManager({
  empresaId,
  equipeInicial,
}: {
  empresaId: string
  equipeInicial: MembroEquipe[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [equipe, setEquipe] = useState(equipeInicial)
  const [dialogo, setDialogo] = useState<{ aberto: boolean; inicial: Rascunho; chave: number }>({
    aberto: false,
    inicial: VAZIO,
    chave: 0,
  })
  const [removendo, setRemovendo] = useState<MembroEquipe | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  function abrir(inicial: Rascunho) {
    setDialogo((d) => ({ aberto: true, inicial, chave: d.chave + 1 }))
  }

  async function salvar(r: Rascunho): Promise<string | null> {
    const campos = {
      nome: r.nome.trim(),
      funcao: r.funcao.trim() || null,
      telefone: r.telefone || null,
    }
    if (r.id) {
      const { data, error } = await supabase
        .from('equipe')
        .update(campos)
        .eq('id', r.id)
        .select('*')
        .single()
      if (error || !data) return error?.message ?? 'Erro ao salvar.'
      setEquipe((e) => e.map((m) => (m.id === r.id ? (data as MembroEquipe) : m)))
      toast.success('Dados atualizados')
    } else {
      const { data, error } = await supabase
        .from('equipe')
        .insert({ empresa_id: empresaId, ...campos })
        .select('*')
        .single()
      if (error || !data) return error?.message ?? 'Erro ao adicionar.'
      setEquipe((e) => [...e, data as MembroEquipe])
      toast.success(`${campos.nome} entrou na equipe`)
    }
    setDialogo((d) => ({ ...d, aberto: false }))
    router.refresh()
    return null
  }

  async function confirmarRemocao() {
    if (!removendo) return
    setExcluindo(true)
    const { error } = await supabase.from('equipe').delete().eq('id', removendo.id)
    setExcluindo(false)
    if (error) {
      toast.error('Não foi possível remover', { description: error.message })
      return
    }
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
        <Button type="button" onClick={() => abrir(VAZIO)}>
          <PlusIcon data-icon="inline-start" />
          Adicionar pessoa
        </Button>
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
                <Button type="button" onClick={() => abrir(VAZIO)}>
                  <PlusIcon data-icon="inline-start" />
                  Adicionar pessoa
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup>
              {equipe.map((m) => {
                const telefone = formatarTelefone(m.telefone)
                return (
                  <Item key={m.id}>
                    <ItemMedia>
                      <Avatar>
                        <AvatarFallback>{iniciais(m.nome)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="truncate">{m.nome}</ItemTitle>
                      {(m.funcao || telefone) && (
                        <ItemDescription className="flex flex-wrap items-center gap-2">
                          {m.funcao && <span className="truncate">{m.funcao}</span>}
                          {m.funcao && telefone && (
                            <span
                              aria-hidden
                              className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                            />
                          )}
                          {telefone && <span className="tabular-nums">{telefone}</span>}
                        </ItemDescription>
                      )}
                    </ItemContent>
                    <ItemActions>
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
                          <DropdownMenuItem
                            onClick={() =>
                              abrir({
                                id: m.id,
                                nome: m.nome,
                                funcao: m.funcao ?? '',
                                telefone: paraE164(m.telefone),
                              })
                            }
                          >
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

      <MembroDialog
        key={dialogo.chave}
        aberto={dialogo.aberto}
        onAbertoChange={(aberto) => setDialogo((d) => ({ ...d, aberto }))}
        inicial={dialogo.inicial}
        onSalvar={salvar}
      />

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
