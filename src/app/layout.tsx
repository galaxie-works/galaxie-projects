import type { Metadata } from 'next'
import {
  Cormorant_Garamond,
  Courier_Prime,
  EB_Garamond,
  Geist,
  Geist_Mono,
  Inter,
  Lora,
  Montserrat,
  Outfit,
  Space_Mono,
} from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { TemaProvider } from '@/components/tema/tema-provider'
import { SCRIPT_TEMA } from '@/lib/temas'
import { cn } from '@/lib/utils'
import './globals.css'

// Fontes dos temas (ver src/app/temas.css). Só as do tema padrão são pré-carregadas;
// as outras o navegador baixa quando o usuário troca de tema.
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', preload: false })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', preload: false })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', preload: false })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', preload: false })
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  preload: false,
})
const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-courier-prime',
  preload: false,
})
const ebGaramond = EB_Garamond({ subsets: ['latin'], variable: '--font-eb-garamond', preload: false })
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cormorant-garamond',
  preload: false,
})

const FONTES = [
  outfit,
  geistMono,
  geist,
  inter,
  montserrat,
  lora,
  spaceMono,
  courierPrime,
  ebGaramond,
  cormorant,
].map((f) => f.variable)

export const metadata: Metadata = {
  title: 'Galaxie Obras',
  description: 'Gestão de obras, clientes e equipe',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={cn('h-full font-sans antialiased', ...FONTES)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TemaProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="bottom-center" />
        </TemaProvider>
      </body>
    </html>
  )
}
