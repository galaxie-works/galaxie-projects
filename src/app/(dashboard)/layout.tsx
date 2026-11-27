import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader, AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { Projeto } from '@/types'
import { RegistroFormulariosProvider } from '@/components/assistente/formulario-assistente'
import { configPublica } from '@/lib/ia/config-servidor'
import { iaGalaxieDisponivel } from '@/lib/ia/cota'
import { carregarAssinatura, situacaoAssinatura } from '@/lib/assinatura'
import { ehAdminMaster } from '@/lib/plataforma/admin'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome, created_at')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!empresa) redirect('/onboarding')

  // Teste grátis acabou (ou assinatura vencida): só a tela de assinatura.
  const assinatura = situacaoAssinatura(
    await carregarAssinatura(supabase, empresa.id),
    empresa.created_at
  )
  if (!assinatura.liberado) redirect('/teste-encerrado')

  const { data: projetos } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .eq('empresa_id', empresa.id)
    .order('created_at', { ascending: false })

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('empresa_id', empresa.id)

  const lista = (projetos as Projeto[]) ?? []
  const [ia, iaGalaxie, adminMaster] = await Promise.all([
    configPublica(supabase, empresa.id).catch(() => null),
    iaGalaxieDisponivel(),
    ehAdminMaster(supabase),
  ])
  const sidebarAberta = (await cookies()).get('sidebar_state')?.value !== 'false'

  return (
    <RegistroFormulariosProvider>
      <SidebarProvider defaultOpen={sidebarAberta}>
        <AppSidebar
          empresaNome={empresa.nome}
          email={user.email ?? ''}
          adminMaster={adminMaster}
          projetos={lista}
          teste={
            assinatura.status === 'teste'
              ? { dias: assinatura.diasRestantes ?? 0, progresso: assinatura.progressoTeste ?? 0 }
              : null
          }
        />
        <SidebarInset className="min-w-0">
          <AppHeader
            projetos={lista.map(({ id, nome }) => ({ id, nome }))}
            clientes={clientes ?? []}
            // Com chave própria, ou pela IA da Galaxie (cota do plano).
            assistenteConfigurado={!!ia?.ativo || iaGalaxie}
            empresaId={empresa.id}
          />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </RegistroFormulariosProvider>
  )
}
