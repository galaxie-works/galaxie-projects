import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EquipeManager } from '@/components/equipe/equipe-manager'
import { urlsDasFotos } from '@/lib/equipe'
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
  const lista = (equipe as MembroEquipe[]) ?? []
  const fotos = await urlsDasFotos(supabase, lista)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <EquipeManager equipeInicial={lista} fotos={fotos} />
    </div>
  )
}
