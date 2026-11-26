import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjetoForm } from '@/components/projetos/projeto-form'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import type { Cliente } from '@/types'

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>
}) {
  const { clienteId } = await searchParams
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

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('nome')

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Frame spacing="default">
        <FrameHeader>
          <FrameTitle>Novo projeto</FrameTitle>
          <FrameDescription>Cliente, prazos e orçamento da obra.</FrameDescription>
        </FrameHeader>
        <FramePanel>
          <ProjetoForm
            empresaId={empresa.id}
            clientes={(clientes as Cliente[]) ?? []}
            clienteIdInicial={clienteId}
          />
        </FramePanel>
      </Frame>
    </div>
  )
}
