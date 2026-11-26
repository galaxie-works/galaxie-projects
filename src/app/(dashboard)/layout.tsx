import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader, AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { Projeto } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  const lista = (projetos as Projeto[]) ?? []
  const sidebarAberta = (await cookies()).get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={sidebarAberta}>
      <AppSidebar empresaNome={empresa.nome} email={user.email ?? ''} projetos={lista} />
      <SidebarInset className="min-w-0">
        <AppHeader projetos={lista.map(({ id, nome }) => ({ id, nome }))} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
