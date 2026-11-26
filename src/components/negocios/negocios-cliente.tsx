'use client'

import { HandshakeIcon, PlusIcon } from 'lucide-react'
import { negocioAberto } from '@/lib/negocios'
import type { MembroEquipe, Negocio } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { CartaoNegocio } from './cartao-negocio'
import { useAcoesNegocio } from './negocio-acoes'

type Props = {
  negocios: Negocio[]
  empresaId: string
  clienteId: string
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  agora: number
  /** Só os abertos, sem o botão grande (coluna do Resumo). */
  compacta?: boolean
}

// Negócios de um cliente, com as mesmas ações do funil.
export function NegociosCliente({ negocios, empresaId, clienteId, equipe, agora, compacta }: Props) {
  const { acoes, dialogos } = useAcoesNegocio({ empresaId, equipe, clienteId })
  const lista = compacta ? negocios.filter(negocioAberto) : negocios

  if (lista.length === 0) {
    return (
      <>
        <Empty className={compacta ? 'p-4' : undefined}>
          <EmptyHeader>
            {!compacta && (
              <EmptyMedia variant="icon">
                <HandshakeIcon />
              </EmptyMedia>
            )}
            <EmptyTitle>{compacta ? 'Nenhum negócio aberto' : 'Nenhum negócio ainda'}</EmptyTitle>
            <EmptyDescription>Abra um negócio quando o cliente pedir uma obra nova.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant={compacta ? 'outline' : 'default'} onClick={() => acoes.novo()}>
              <PlusIcon data-icon="inline-start" />
              Novo negócio
            </Button>
          </EmptyContent>
        </Empty>
        {dialogos}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ItemGroup className="gap-2">
        {lista.map((n) => (
          <CartaoNegocio key={n.id} negocio={n} acoes={acoes} agora={agora} mostrarFase mostrarCliente={false} />
        ))}
      </ItemGroup>
      <Button type="button" variant="outline" className="self-start" onClick={() => acoes.novo()}>
        <PlusIcon data-icon="inline-start" />
        Novo negócio
      </Button>
      {dialogos}
    </div>
  )
}
