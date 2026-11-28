import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MembroForm } from '@/components/equipe/membro-form'
import { exigirAcesso, idDaEmpresa } from '@/lib/acesso'

export default async function NovaPessoaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await exigirAcesso('equipe', 'editar')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', await idDaEmpresa())
    .maybeSingle()
  if (!empresa) redirect('/onboarding')

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Nova pessoa</h1>
        <p className="text-muted-foreground text-sm">Quem trabalha com você nas obras.</p>
      </header>
      <MembroForm empresaId={empresa.id} />
    </div>
  )
}
