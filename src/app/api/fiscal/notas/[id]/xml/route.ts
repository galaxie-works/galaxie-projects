import { createClient } from '@/lib/supabase/server'

// Baixa o XML da nota: o da NFS-e autorizada, ou o da DPS enviada se ainda não houver.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: nota } = await supabase
    .from('notas_fiscais')
    .select('xml_nfse, xml_dps, numero_nfse, numero_dps, chave_acesso')
    .eq('id', id)
    .maybeSingle()
  if (!nota) return new Response('Nota não encontrada.', { status: 404 })
  const xml = (nota.xml_nfse as string | null) ?? (nota.xml_dps as string | null) ?? ''
  const nome = nota.xml_nfse
    ? `NFSe-${nota.numero_nfse ?? nota.chave_acesso}.xml`
    : `DPS-${nota.numero_dps}.xml`
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
}
