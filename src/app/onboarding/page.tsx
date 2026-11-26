import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingChat from '@/components/OnboardingChat'

export default async function OnboardingPage() {
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

  if (empresa) redirect('/projetos')

  return <OnboardingChat />
}
