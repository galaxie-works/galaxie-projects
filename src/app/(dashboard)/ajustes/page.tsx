import { redirect } from 'next/navigation'
import { chaveMestraConfigurada } from '@/lib/ia/cripto'
import { configPublica, sessaoEmpresa } from '@/lib/ia/config-servidor'
import { AjustesIAForm } from '@/components/ajustes/ajustes-ia-form'

export default async function AjustesPage() {
  const sessao = await sessaoEmpresa()
  if (!sessao) redirect('/login')
  const config = await configPublica(sessao.supabase, sessao.empresaId).catch(() => null)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-muted-foreground text-sm">
            Ligue o assistente de IA: fale o que precisa e ele preenche, salva, edita e exclui por você.
          </p>
        </header>
        <AjustesIAForm config={config} servidorPronto={chaveMestraConfigurada()} />
      </div>
    </div>
  )
}
