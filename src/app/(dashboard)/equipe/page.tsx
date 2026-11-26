import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EquipeManager from '@/components/EquipeManager'
import type { MembroEquipe } from '@/types'

export default async function EquipePage() {
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

  const { data: equipe } = await supabase
    .from('equipe')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('created_at')

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Equipe</h1>
      <EquipeManager
        empresaId={empresa.id}
        equipeInicial={(equipe as MembroEquipe[]) ?? []}
      />
    </div>
  )
}
