import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import type { Projeto } from '@/types'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!empresa) redirect('/onboarding')

  const { data: projetos } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen">
      <Sidebar empresaNome={empresa.nome} projetos={(projetos as Projeto[]) ?? []} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
