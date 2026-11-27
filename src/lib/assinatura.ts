import type { SupabaseClient } from '@supabase/supabase-js'

// Assinatura do SaaS: uma por empresa (o tenant). Toda conta nova começa com
// 30 dias de teste grátis. A regra de acesso é a mesma da função
// public.assinatura_vigente do banco (migration 20261127170000_assinaturas).

export const DIAS_TESTE = 30
/** Dias de tolerância depois de um pagamento atrasado. */
export const DIAS_TOLERANCIA = 7

export type TipoPessoa = 'PF' | 'PJ'
export type StatusAssinatura = 'teste' | 'ativa' | 'atrasada' | 'cancelada' | 'cortesia'

export type Assinatura = {
  empresa_id: string
  plano: string
  status: StatusAssinatura
  teste_inicio: string
  teste_fim: string
  periodo_fim: string | null
  /** Preenchidos pela cobrança do Stripe (migration 20261127180000). */
  ciclo?: 'mensal' | 'anual' | null
  cancela_no_fim?: boolean
  gateway_cliente_id?: string | null
  gateway_assinatura_id?: string | null
}

export type Situacao = {
  status: StatusAssinatura
  /** Pode usar o app agora. */
  liberado: boolean
  /** Até quando vale o acesso (null = não vence). */
  fim: Date | null
  /** Dias que faltam até `fim`, arredondando para cima (1 = último dia, 0 = acabou). */
  diasRestantes: number | null
  /** Só no teste: quanto do período já passou, de 0 a 100. */
  progressoTeste: number | null
}

const DIA = 24 * 60 * 60 * 1000

/** Pessoa física não emite nota fiscal; pessoa jurídica emite NFS-e. */
export function emiteNotaFiscal(tipo: TipoPessoa | null | undefined) {
  return tipo !== 'PF'
}

/**
 * Situação da assinatura. Sem linha no banco (empresa criada antes da tabela
 * existir no ambiente), conta o teste a partir da criação da empresa.
 */
export function situacaoAssinatura(
  assinatura: Assinatura | null,
  empresaCriadaEm: string,
  agora: Date = new Date()
): Situacao {
  const a: Assinatura = assinatura ?? {
    empresa_id: '',
    plano: 'teste',
    status: 'teste',
    teste_inicio: empresaCriadaEm,
    teste_fim: new Date(new Date(empresaCriadaEm).getTime() + DIAS_TESTE * DIA).toISOString(),
    periodo_fim: null,
  }
  const periodoFim = a.periodo_fim ? new Date(a.periodo_fim) : null

  let fim: Date | null
  switch (a.status) {
    case 'cortesia':
      fim = null
      break
    case 'ativa':
      fim = periodoFim
      break
    case 'atrasada':
      fim = new Date((periodoFim ?? agora).getTime() + DIAS_TOLERANCIA * DIA)
      break
    case 'cancelada':
      fim = periodoFim ?? new Date(0)
      break
    default:
      fim = new Date(a.teste_fim)
  }

  const liberado = fim === null || fim.getTime() > agora.getTime()
  const diasRestantes =
    fim === null ? null : Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / DIA))

  let progressoTeste: number | null = null
  if (a.status === 'teste') {
    const inicio = new Date(a.teste_inicio).getTime()
    const total = Math.max(1, new Date(a.teste_fim).getTime() - inicio)
    progressoTeste = Math.min(100, Math.max(0, ((agora.getTime() - inicio) / total) * 100))
  }

  return { status: a.status, liberado, fim, diasRestantes, progressoTeste }
}

/**
 * Lê a assinatura da empresa. Devolve null só quando a tabela ainda não existe
 * no banco (antes da migration), e aí vale o teste contado da criação da
 * empresa. Empresa sem linha é tratada como bloqueada, igual a
 * public.assinatura_vigente. Qualquer outro erro sobe, para não liberar nem
 * bloquear ninguém por engano.
 */
export async function carregarAssinatura(
  supabase: SupabaseClient,
  empresaId: string
): Promise<Assinatura | null> {
  const { data, error } = await supabase
    .from('assinaturas')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    throw new Error(`Não foi possível ler a assinatura: ${error.message}`)
  }
  if (!data) {
    return {
      empresa_id: empresaId,
      plano: 'teste',
      status: 'cancelada',
      teste_inicio: new Date(0).toISOString(),
      teste_fim: new Date(0).toISOString(),
      periodo_fim: null,
    }
  }
  return data as Assinatura
}

export const ROTULO_STATUS: Record<StatusAssinatura, string> = {
  teste: 'Teste grátis',
  ativa: 'Ativa',
  atrasada: 'Pagamento atrasado',
  cancelada: 'Cancelada',
  cortesia: 'Cortesia',
}

/** "Faltam 12 dias", "Faltam 2 dias", "Último dia". */
export function textoDiasRestantes(dias: number) {
  return dias <= 1 ? 'Último dia' : `Faltam ${dias} dias`
}
