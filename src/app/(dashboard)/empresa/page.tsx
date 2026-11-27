import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmpresaForm } from '@/components/empresa/empresa-form'
import { carregarPrecos } from '@/components/orcamento/dados'
import { chaveMestraConfigurada } from '@/lib/ia/cripto'
import type { CertificadoPublico, EmpresaFiscal } from '@/lib/fiscal/tipos'
import type { Empresa } from '@/types'

export default async function EmpresaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!empresa) redirect('/onboarding')
  const [precos, { data: fiscal }, { data: certificado }] = await Promise.all([
    carregarPrecos(supabase, empresa.id),
    supabase.from('empresa_fiscal').select('*').eq('empresa_id', empresa.id).maybeSingle(),
    supabase
      .from('empresa_certificados')
      .select('titular, documento, valido_ate, enviado_em')
      .eq('empresa_id', empresa.id)
      .maybeSingle(),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Empresa</h1>
          <p className="text-muted-foreground text-sm">Seus dados, os serviços que você faz, quanto cobra e a nota fiscal.</p>
        </header>
        <EmpresaForm
          empresa={empresa as Empresa}
          precos={precos}
          fiscal={(fiscal as EmpresaFiscal | null) ?? null}
          certificado={(certificado as CertificadoPublico | null) ?? null}
          servidorPronto={chaveMestraConfigurada()}
        />
      </div>
    </div>
  )
}
