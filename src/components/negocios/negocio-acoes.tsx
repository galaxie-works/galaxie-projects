'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ganharNegocio, moverNegocio, obraDoOrcamento, perderNegocio } from '@/lib/negocios'
import { FASE_NEGOCIO_LABEL, type FaseNegocio, type MembroEquipe, type Negocio } from '@/types'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { NegocioDialog, type ClienteOpcao } from './negocio-dialog'
import { PerderDialog } from './perder-dialog'

export type AcoesNegocio = {
  novo: (fase?: FaseNegocio) => void
  editar: (n: Negocio) => void
  orcamento: (n: Negocio) => Promise<void>
  ganhar: (n: Negocio) => Promise<boolean>
  perder: (n: Negocio) => void
  mover: (n: Negocio, fase: FaseNegocio, ordem: number) => Promise<boolean>
  excluir: (n: Negocio) => void
}

type Opcoes = {
  empresaId: string
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  clientes?: ClienteOpcao[]
  clienteId?: string
  proximaOrdem?: number
}

// Ações de um negócio, iguais no funil e no painel do cliente: abrir,
// editar, montar orçamento, ganhar, perder (com motivo) e excluir.
export function useAcoesNegocio({ empresaId, equipe, clientes, clienteId, proximaOrdem = 0 }: Opcoes) {
  const router = useRouter()
  const [dialogo, setDialogo] = useState<{ negocio?: Negocio; fase?: FaseNegocio } | null>(null)
  const [perdendo, setPerdendo] = useState<Negocio | null>(null)
  const [excluindo, setExcluindo] = useState<Negocio | null>(null)

  const acoes: AcoesNegocio = {
    novo: (fase) => setDialogo({ fase }),
    editar: (negocio) => setDialogo({ negocio }),
    async orcamento(n) {
      const { error, projetoId } = await obraDoOrcamento(createClient(), n)
      if (error || !projetoId) {
        toast.error('Não foi possível abrir o orçamento', { description: error ?? undefined })
        return
      }
      router.push(`/projetos/${projetoId}?aba=orcamento`)
    },
    async ganhar(n) {
      const { error } = await ganharNegocio(createClient(), n)
      if (error) {
        toast.error('Não foi possível marcar como ganho', { description: error })
        return false
      }
      toast.success(`${n.titulo}: ganho`, { description: 'A obra está em Planejamento até começar.' })
      router.refresh()
      return true
    },
    perder: (n) => setPerdendo(n),
    async mover(n, fase, ordem) {
      const { error } = await moverNegocio(createClient(), n, fase, ordem)
      if (error) {
        toast.error('Não foi possível mover o negócio', { description: error })
        return false
      }
      if (n.fase !== fase) toast.success(`${n.titulo}: ${FASE_NEGOCIO_LABEL[fase]}`)
      router.refresh()
      return true
    },
    excluir: (n) => setExcluindo(n),
  }

  const dialogos = (
    <>
      <NegocioDialog
        aberto={dialogo !== null}
        onOpenChange={(v) => !v && setDialogo(null)}
        empresaId={empresaId}
        equipe={equipe}
        clientes={clientes}
        clienteId={clienteId}
        negocio={dialogo?.negocio}
        faseInicial={dialogo?.fase}
        ordem={proximaOrdem}
        onSalvo={() => router.refresh()}
      />
      <PerderDialog
        aberto={perdendo !== null}
        onOpenChange={(v) => !v && setPerdendo(null)}
        titulo={perdendo?.titulo ?? ''}
        onConfirmar={async (motivo) => {
          if (!perdendo) return false
          const { error } = await perderNegocio(createClient(), perdendo, motivo)
          if (error) {
            toast.error('Não foi possível marcar como perdido', { description: error })
            return false
          }
          toast.success(`${perdendo.titulo}: perdido`)
          router.refresh()
          return true
        }}
      />
      <ConfirmarExclusao
        aberto={excluindo !== null}
        onOpenChange={(v) => !v && setExcluindo(null)}
        titulo="Excluir este negócio?"
        descricao={
          excluindo
            ? `“${excluindo.titulo}” sai do funil. A obra e o orçamento ligados continuam.`
            : ''
        }
        rotulo="Excluir negócio"
        onConfirmar={async () => {
          if (!excluindo) return false
          const { error } = await createClient().from('negocios').delete().eq('id', excluindo.id)
          if (error) {
            toast.error('Não foi possível excluir', { description: error.message })
            return false
          }
          toast.success('Negócio excluído')
          router.refresh()
          return true
        }}
      />
    </>
  )

  return { acoes, dialogos }
}
