import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusIcon, UsersIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ClientesTabela, type ClienteLinha } from '@/components/clientes/clientes-tabela'
import { Frame, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { faseDoCliente, hojeISO, numerosDoCliente } from '@/lib/crm'
import type { Cliente, Projeto } from '@/types'

export default async function ClientesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('*, projetos(status, orcamento_total)')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  type ComObras = Cliente & { projetos: Pick<Projeto, 'status' | 'orcamento_total'>[] | null }
  const lista: ClienteLinha[] = ((clientes as ComObras[]) ?? []).map(({ projetos, ...c }) => {
    const obras = projetos ?? []
    return {
      ...c,
      fase: faseDoCliente({ fase_manual: c.fase_manual ?? null }, obras),
      contratado: numerosDoCliente(obras).contratado,
      totalProjetos: obras.length,
    }
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Pessoas e empresas para quem você trabalha.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
          <PlusIcon data-icon="inline-start" />
          Novo cliente
        </Button>
      </header>

      {lista.length === 0 ? (
        <Frame spacing="default">
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum cliente ainda</EmptyTitle>
                <EmptyDescription>
                  Cadastre o primeiro cliente para abrir projetos para ele.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
                  <PlusIcon data-icon="inline-start" />
                  Novo cliente
                </Button>
              </EmptyContent>
            </Empty>
          </FramePanel>
        </Frame>
      ) : (
        <ClientesTabela clientes={lista} hoje={hojeISO()} />
      )}
    </div>
  )
}
