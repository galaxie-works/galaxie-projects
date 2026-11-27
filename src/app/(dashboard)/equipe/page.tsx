import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EquipeManager } from '@/components/equipe/equipe-manager'
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

  const { data: equipe, error } = await supabase
    .from('equipe')
    .select('*')
    .eq('empresa_id', empresa.id)
    .order('created_at')
  if (error) throw new Error(error.message)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        <EquipeManager empresaId={empresa.id} equipeInicial={(equipe as MembroEquipe[]) ?? []} />
      </div>
    </div>
  )
}
