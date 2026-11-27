import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Geist } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { TemaProvider } from '@/components/tema/tema-provider'
import { TEMA_COOKIE, TEMA_PADRAO, temaValido } from '@/lib/temas'
import { cn } from '@/lib/utils'
import { RegistrarServiceWorker } from '@/components/pwa/registrar-sw'
import './globals.css'

// Fonte do ReUI; os temas trocam só as cores.
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Galaxie Obras',
  description: 'Gestão de obras, clientes e equipe',
  appleWebApp: { capable: true, title: 'Galaxie Obras', statusBarStyle: 'default' },
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const tema = (await cookies()).get(TEMA_COOKIE)?.value

  return (
    <html
      lang="pt-BR"
      className={cn('h-full font-sans antialiased', geist.variable)}
      data-theme={temaValido(tema) && tema !== TEMA_PADRAO ? tema : undefined}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TemaProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="bottom-center" />
          <RegistrarServiceWorker />
        </TemaProvider>
      </body>
    </html>
  )
}
