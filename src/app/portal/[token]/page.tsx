import type { Metadata } from 'next'
import { LinkIcon } from 'lucide-react'
import { clienteAnonimo } from '@/lib/supabase/anonimo'
import { clienteAdmin } from '@/lib/supabase/admin'
import { hojeISO } from '@/lib/crm'
import { tokenValido, type PortalDados } from '@/lib/portal'
import { PortalCliente } from '@/components/portal/portal-cliente'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// Portal do cliente final: página pública, protegida pelo token do link.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Acompanhe sua obra',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

async function carregar(token: string): Promise<PortalDados | null> {
  if (!tokenValido(token)) return null
  const { data, error } = await clienteAnonimo().rpc('portal_dados', { p_token: token })
  if (error || !data) return null
  const dados = data as PortalDados

  // Fotos e documentos ficam em bucket privado: o servidor assina só os
  // caminhos que a função portal_dados liberou para este token.
  const admin = clienteAdmin()
  if (admin && dados.arquivos.length) {
    const { data: urls } = await admin.storage
      .from('arquivos')
      .createSignedUrls(dados.arquivos.map((a) => a.caminho), 3600)
    const mapa = new Map(urls?.filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl]) ?? [])
    dados.arquivos = dados.arquivos.map((a) => ({ ...a, url: mapa.get(a.caminho) ?? undefined }))
  }
  return dados
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const dados = await carregar(token)

  if (!dados) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>Link indisponível</EmptyTitle>
            <EmptyDescription>
              Este link de acompanhamento não existe ou foi desativado. Peça um novo link à empresa responsável pela
              sua obra.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    )
  }

  return <PortalCliente token={token} dados={dados} hoje={hojeISO()} />
}
