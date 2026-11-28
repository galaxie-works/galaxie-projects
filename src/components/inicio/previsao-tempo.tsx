import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { buscarCidades, buscarPrevisao, type CidadeClima } from '@/lib/clima'
import { hojeISO } from '@/lib/crm'
import { cn } from '@/lib/utils'
import { PrevisaoTempoPainel, type ObraNaChuva } from '@/components/inicio/previsao-tempo-painel'

/**
 * Previsão do tempo do Início. Usa a cidade escolhida no próprio widget; sem
 * ela, tenta a cidade dos dados fiscais da empresa. Cruza os dias de chuva
 * com as obras em execução e os inícios marcados para os próximos 7 dias.
 */
export function PrevisaoTempo({ empresaId, className }: { empresaId: string; className?: string }) {
  return (
    <Suspense fallback={<Skeleton className={cn('h-36 rounded-xl', className)} />}>
      <Conteudo empresaId={empresaId} className={className} />
    </Suspense>
  )
}

async function Conteudo({ empresaId, className }: { empresaId: string; className?: string }) {
  const supabase = await createClient()
  const hoje = hojeISO()

  const [{ data: empresa }, { data: fiscal }, { data: projetos }] = await Promise.all([
    supabase
      .from('empresas')
      .select('clima_cidade, clima_uf, clima_latitude, clima_longitude')
      .eq('id', empresaId)
      .maybeSingle(),
    supabase.from('empresa_fiscal').select('cidade, uf').eq('empresa_id', empresaId).maybeSingle(),
    supabase
      .from('projetos')
      .select('id, nome, status, data_inicio')
      .eq('empresa_id', empresaId)
      .in('status', ['em_execucao', 'planejamento']),
  ])

  let cidade: CidadeClima | null = null
  if (empresa?.clima_cidade && empresa.clima_latitude != null && empresa.clima_longitude != null) {
    cidade = {
      nome: empresa.clima_cidade,
      uf: empresa.clima_uf,
      latitude: empresa.clima_latitude,
      longitude: empresa.clima_longitude,
    }
  } else if (fiscal?.cidade) {
    const achadas = await buscarCidades(fiscal.uf ? `${fiscal.cidade}, ${fiscal.uf}` : fiscal.cidade)
    cidade = achadas[0] ?? null
  }

  const previsao = cidade ? await buscarPrevisao(cidade.latitude, cidade.longitude) : null
  const diasChuva = new Set(previsao?.dias.filter((d) => d.risco === 'chuva').map((d) => d.data) ?? [])

  const obras: ObraNaChuva[] = []
  if (diasChuva.size > 0) {
    for (const p of (projetos as { id: string; nome: string; status: string; data_inicio: string | null }[]) ?? []) {
      if (p.status === 'em_execucao') {
        obras.push({ id: p.id, nome: p.nome, motivo: 'execucao' })
      } else if (p.data_inicio && diasChuva.has(p.data_inicio.slice(0, 10))) {
        obras.push({ id: p.id, nome: p.nome, motivo: 'inicio', dia: p.data_inicio.slice(0, 10) })
      }
    }
  }

  const rotuloCidade = cidade ? (cidade.uf ? `${cidade.nome}, ${cidade.uf}` : cidade.nome) : null

  return (
    <PrevisaoTempoPainel cidade={rotuloCidade} previsao={previsao} hoje={hoje} obras={obras} className={className} />
  )
}
