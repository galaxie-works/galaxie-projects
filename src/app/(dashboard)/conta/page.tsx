import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FotoUsuario } from '@/components/marca/foto-usuario'
import { NomeUsuario } from '@/components/marca/nome-usuario'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { urlAssinada } from '@/lib/marca'
import type { Perfil } from '@/types'
import { idDaEmpresa } from '@/lib/acesso'

export default async function ContaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: empresa }, { data: perfil }] = await Promise.all([
    supabase.from('empresas').select('id').eq('id', await idDaEmpresa()).maybeSingle(),
    supabase.from('perfis').select('*').eq('user_id', user.id).maybeSingle(),
  ])
  if (!empresa) redirect('/onboarding')
  const p = perfil as Perfil | null
  const fotoUrl = await urlAssinada(supabase, p?.foto_caminho)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Minha conta</h1>
        <p className="text-muted-foreground text-sm">Seu nome e sua foto no app.</p>
      </header>
      <Frame spacing="default" className="max-w-2xl">
        <FrameHeader>
          <FrameTitle>Perfil</FrameTitle>
          <FrameDescription>Só você muda os seus dados.</FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-6">
          <FotoUsuario
            empresaId={empresa.id}
            userId={user.id}
            caminhoAtual={p?.foto_caminho ?? null}
            urlAtual={fotoUrl}
          />
          <NomeUsuario userId={user.id} nomeAtual={p?.nome ?? ''} email={user.email ?? ''} />
        </FramePanel>
      </Frame>
    </div>
  )
}
