import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClienteForm } from '@/components/clientes/cliente-form'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export default async function NovoClientePage() {
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

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/clientes" />}>Clientes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Novo</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <header className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold tracking-tight">Novo cliente</h1>
            <p className="text-muted-foreground text-sm">
              Pessoa física ou empresa que contrata a obra.
            </p>
          </header>
        </div>
        <ClienteForm empresaId={empresa.id} />
      </div>
    </div>
  )
}
