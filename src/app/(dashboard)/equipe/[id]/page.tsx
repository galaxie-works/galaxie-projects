import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MembroForm } from '@/components/equipe/membro-form'
import { urlsDasFotos } from '@/lib/equipe'
import type { MembroEquipe } from '@/types'

export default async function EditarPessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: membro } = await supabase
    .from('equipe')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresa.id)
    .maybeSingle()
  if (!membro) notFound()

  const fotos = await urlsDasFotos(supabase, [membro as MembroEquipe])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">{membro.nome}</h1>
        <p className="text-muted-foreground text-sm">{membro.funcao || 'Pessoa da equipe'}</p>
      </header>
      <MembroForm empresaId={empresa.id} membro={membro as MembroEquipe} fotoUrl={fotos[membro.id] ?? null} />
    </div>
  )
}
