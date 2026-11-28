import { createClient } from '@/lib/supabase/server'
import { AcessosPainel, type LinhaAcesso } from '@/components/acessos/acessos-painel'
import { ehLoginDeCampo, exigirAcesso, type Papel, type Permissoes } from '@/lib/acesso'
import { carregarAssinatura } from '@/lib/assinatura'
import { BUCKET_MARCA } from '@/lib/marca'
import { lerTodosPlanos } from '@/lib/plataforma/config'

type Linha = {
  id: string
  user_id: string | null
  email: string
  papel: Papel
  permissoes: Permissoes
  equipe_id: string | null
  status: 'convidado' | 'ativo' | 'suspenso'
}

export default async function AcessosPage() {
  const sessao = await exigirAcesso('acessos')
  const supabase = await createClient()

  const [{ data: membros, error }, { data: equipe }, assinatura, planos] = await Promise.all([
    supabase
      .from('empresa_membros')
      .select('id, user_id, email, papel, permissoes, equipe_id, status')
      .eq('empresa_id', sessao.empresaId)
      .order('created_at'),
    supabase.from('equipe').select('id, nome').eq('empresa_id', sessao.empresaId).order('nome'),
    carregarAssinatura(supabase, sessao.empresaId),
    lerTodosPlanos(),
  ])
  const linhas = (membros as Linha[] | null) ?? []

  const ids = linhas.map((l) => l.user_id).filter((x): x is string => !!x)
  const { data: perfis } = ids.length
    ? await supabase.from('perfis').select('user_id, nome, foto_caminho').in('user_id', ids)
    : { data: [] }
  const perfilDe = new Map(
    ((perfis as { user_id: string; nome: string | null; foto_caminho: string | null }[] | null) ?? []).map((p) => [p.user_id, p])
  )
  const caminhos = [...perfilDe.values()].map((p) => p.foto_caminho).filter((x): x is string => !!x)
  const { data: assinadas } = caminhos.length
    ? await supabase.storage.from(BUCKET_MARCA).createSignedUrls(caminhos, 3600)
    : { data: [] }
  const urlDe = new Map(caminhos.map((c, i) => [c, assinadas?.[i]?.signedUrl ?? null]))
  const nomeEquipe = new Map((equipe ?? []).map((e) => [e.id as string, e.nome as string]))

  const lista: LinhaAcesso[] = linhas.map((l) => {
    const p = l.user_id ? perfilDe.get(l.user_id) : undefined
    return {
      id: l.id,
      email: l.email,
      papel: l.papel,
      permissoes: l.permissoes ?? {},
      equipe_id: l.equipe_id,
      status: l.status,
      nome: p?.nome ?? null,
      fotoUrl: p?.foto_caminho ? (urlDe.get(p.foto_caminho) ?? null) : null,
      equipeNome: l.equipe_id ? (nomeEquipe.get(l.equipe_id) ?? null) : null,
    }
  })

  const pago = assinatura && (assinatura.status === 'ativa' || assinatura.status === 'atrasada')
  const plano =
    (pago ? planos.find((p) => p.id === assinatura.plano) : null) ?? [...planos].sort((a, b) => b.mensal - a.mensal)[0]
  const contando = linhas.filter((l) => l.status !== 'suspenso')
  const campo = contando.filter((l) => ehLoginDeCampo(l.papel, l.permissoes ?? {})).length

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Acessos</h1>
        <p className="text-muted-foreground text-sm">
          Quem da sua empresa entra no app e o que cada pessoa vê e edita.
        </p>
      </header>
      {error ? (
        <p className="text-muted-foreground text-sm">
          Os acessos ainda estão sendo preparados no servidor. Tente de novo em alguns minutos.
        </p>
      ) : (
        <AcessosPainel
          membros={lista}
          equipe={(equipe as { id: string; nome: string }[] | null) ?? []}
          uso={{
            plano: pago
              ? (plano?.nome ?? '')
              : `${plano?.nome ?? ''} (${assinatura?.status === 'cortesia' ? 'cortesia' : 'teste grátis'})`,
            escritorio: [contando.length - campo, plano?.usuariosEscritorio ?? null],
            campo: [campo, plano?.usuariosCampo ?? null],
          }}
        />
      )}
    </div>
  )
}
