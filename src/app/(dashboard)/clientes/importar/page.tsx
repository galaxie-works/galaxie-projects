import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImportarClientes } from '@/components/clientes/importar/importar-clientes'

export default async function ImportarClientesPage() {
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Importar clientes</h1>
          <p className="text-muted-foreground text-sm">
            Traga sua lista de clientes de uma planilha. Quem já está cadastrado é reconhecido pelo telefone ou CPF/CNPJ.
          </p>
        </header>
        <ImportarClientes empresaId={empresa.id} />
      </div>
    </div>
  )
}
