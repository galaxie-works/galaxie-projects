'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EllipsisIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatarData } from '@/lib/formato'
import { VARIANTE_STATUS_PROJETO } from '@/lib/status'
import { STATUS_PROJETO_LABEL, type Cliente, type Projeto, type StatusProjeto } from '@/types'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { ProjetoForm } from '@/components/projetos/projeto-form'

const ITENS_STATUS = (Object.entries(STATUS_PROJETO_LABEL) as [StatusProjeto, string][]).map(
  ([value, label]) => ({ value, label })
)

type Props = {
  projeto: Projeto
  clientes: Cliente[]
  atrasado: boolean
  /** O total vem das áreas e medidas (aba Orçamento). */
  totalCalculado?: boolean
}

export function ProjetoCabecalho({ projeto, clientes, atrasado, totalCalculado = false }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<StatusProjeto>(projeto.status)
  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  async function atualizarStatus(novo: StatusProjeto) {
    const anterior = status
    setStatus(novo)
    const { error } = await createClient()
      .from('projetos')
      .update({ status: novo })
      .eq('id', projeto.id)
    if (error) {
      setStatus(anterior)
      toast.error('Não foi possível mudar o status', { description: error.message })
      return
    }
    toast.success(`Status: ${STATUS_PROJETO_LABEL[novo]}`)
    router.refresh()
  }

  async function excluir() {
    const { error } = await createClient().from('projetos').delete().eq('id', projeto.id)
    if (error) {
      toast.error('Não foi possível excluir', { description: error.message })
      return false
    }
    toast.success('Projeto excluído')
    router.push('/projetos')
    router.refresh()
    return true
  }

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href={`/clientes/${projeto.cliente_id}`}
          className="w-fit truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {projeto.clientes?.nome ?? 'Cliente'}
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight">{projeto.nome}</h1>
          <Badge variant={atrasado && status !== 'completo' ? 'destructive-light' : VARIANTE_STATUS_PROJETO[status]}>
            {atrasado && status !== 'completo' ? 'Atrasada' : STATUS_PROJETO_LABEL[status]}
          </Badge>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>Início {formatarData(projeto.data_inicio)}</span>
          <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
          <span>Prazo {formatarData(projeto.data_prazo)}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Select
          items={ITENS_STATUS}
          value={status}
          onValueChange={(v) => v && v !== status && atualizarStatus(v as StatusProjeto)}
        >
          <SelectTrigger size="sm" aria-label="Status do projeto" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITENS_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
          <PencilIcon data-icon="inline-start" />
          Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Mais ações" />}
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(true)}>
              <Trash2Icon />
              Excluir projeto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar projeto</DialogTitle>
            <DialogDescription>Nome, cliente, prazos e orçamento.</DialogDescription>
          </DialogHeader>
          <ProjetoForm
            key={editando ? 'aberto' : 'fechado'}
            empresaId={projeto.empresa_id}
            clientes={clientes}
            projeto={{ ...projeto, status }}
            totalCalculado={totalCalculado}
            onSalvo={() => setEditando(false)}
            onCancelar={() => setEditando(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmarExclusao
        aberto={excluindo}
        onOpenChange={setExcluindo}
        titulo="Excluir este projeto?"
        descricao="Etapas e compras da obra também serão apagadas. Não dá para desfazer."
        rotulo="Excluir projeto"
        onConfirmar={excluir}
      />
    </header>
  )
}
