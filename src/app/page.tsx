import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { idDaEmpresa } from '@/lib/acesso'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', await idDaEmpresa())
    .maybeSingle()

  if (!empresa) {
    redirect('/onboarding')
  }

  redirect('/inicio')
}
