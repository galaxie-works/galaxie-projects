import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Onboarding } from '@/components/onboarding/onboarding'
import { carregarSessao, idDaEmpresa } from '@/lib/acesso'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if ((await carregarSessao()).situacao === 'suspenso') redirect('/sem-acesso')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('id', await idDaEmpresa())
    .maybeSingle()

  if (empresa) redirect('/projetos')

  return <Onboarding userId={user.id} />
}
