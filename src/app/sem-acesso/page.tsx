import { redirect } from 'next/navigation'
import { LockIcon } from 'lucide-react'
import { BotaoSair } from '@/components/assinatura/botao-sair'
import { Marca } from '@/components/onboarding/marca'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { carregarSessao } from '@/lib/acesso'

// Quem teve o acesso suspenso pelo dono da empresa.
export default async function SemAcessoPage() {
  const s = await carregarSessao()
  if (s.situacao === 'sem-login') redirect('/login')
  if (s.situacao === 'ok') redirect('/inicio')

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <Marca />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon />
          </EmptyMedia>
          <EmptyTitle>Seu acesso está suspenso</EmptyTitle>
          <EmptyDescription>
            Seu acesso está pausado. Fale com o responsável pela empresa para reativar.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotaoSair />
        </EmptyContent>
      </Empty>
    </main>
  )
}
