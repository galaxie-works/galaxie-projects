import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileUpIcon, PlusIcon, UsersIcon } from 'lucide-react'
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
import type { Cliente, Negocio, Projeto } from '@/types'

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

  // Com negócios (fase 2 do CRM); se a tabela ainda não existe, sem eles.
  const consulta = (campos: string) =>
    supabase
      .from('clientes')
      .select(campos)
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false })
  let resposta = await consulta('*, projetos(status, orcamento_total), negocios(fase)')
  if (resposta.error) resposta = await consulta('*, projetos(status, orcamento_total)')
  if (resposta.error) throw new Error(resposta.error.message)

  type ComObras = Cliente & {
    projetos: Pick<Projeto, 'status' | 'orcamento_total'>[] | null
    negocios?: Pick<Negocio, 'fase'>[] | null
  }
  const lista: ClienteLinha[] = ((resposta.data as unknown as ComObras[]) ?? []).map(
    ({ projetos, negocios, ...c }) => {
      const obras = projetos ?? []
      return {
        ...c,
        fase: faseDoCliente({ fase_manual: c.fase_manual ?? null }, obras, negocios ?? []),
        contratado: numerosDoCliente(obras).contratado,
        totalProjetos: obras.filter((o) => o.status !== 'cancelado').length,
      }
    }
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Pessoas e empresas para quem você trabalha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/clientes/importar" />}>
            <FileUpIcon data-icon="inline-start" />
            Importar
          </Button>
          <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
            <PlusIcon data-icon="inline-start" />
            Novo cliente
          </Button>
        </div>
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
              <EmptyContent className="flex-row flex-wrap justify-center">
                <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
                  <PlusIcon data-icon="inline-start" />
                  Novo cliente
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/clientes/importar" />}>
                  <FileUpIcon data-icon="inline-start" />
                  Importar planilha
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
