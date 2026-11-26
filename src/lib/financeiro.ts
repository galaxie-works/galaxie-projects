import type { Recebimento } from '@/types'

// ---------------------------------------------------------------------------
// Quem vê valores. Ponto ÚNICO de checagem: hoje só o dono da empresa entra
// no app, então sempre libera. A Frente E (equipe com papéis) troca o corpo
// desta função para dono/gestor = true, membro = false.
// ---------------------------------------------------------------------------
export type PapelUsuario = 'dono' | 'gestor' | 'membro'

export function podeVerFinanceiro(papel: PapelUsuario = 'dono'): boolean {
  return papel === 'dono' || papel === 'gestor'
}

export type SituacaoRecebimento = 'recebido' | 'atrasado' | 'hoje' | 'a_vencer'

export const SITUACAO_LABEL: Record<SituacaoRecebimento, string> = {
  recebido: 'Recebido',
  atrasado: 'Atrasado',
  hoje: 'Vence hoje',
  a_vencer: 'A vencer',
}

export const VARIANTE_SITUACAO: Record<
  SituacaoRecebimento,
  'success-light' | 'destructive-light' | 'warning-light' | 'invert-light'
> = {
  recebido: 'success-light',
  atrasado: 'destructive-light',
  hoje: 'warning-light',
  a_vencer: 'invert-light',
}

type RecebimentoBase = Pick<Recebimento, 'valor' | 'vencimento' | 'recebido_em'>

export function situacaoRecebimento(r: RecebimentoBase, hoje: string): SituacaoRecebimento {
  if (r.recebido_em) return 'recebido'
  const v = r.vencimento.slice(0, 10)
  if (v < hoje) return 'atrasado'
  if (v === hoje) return 'hoje'
  return 'a_vencer'
}

export type ResumoFinanceiro = {
  total: number
  recebido: number
  aReceber: number
  atrasado: number
  parcelas: number
  parcelasAtrasadas: number
}

export function resumoRecebimentos(lista: RecebimentoBase[], hoje: string): ResumoFinanceiro {
  const r: ResumoFinanceiro = { total: 0, recebido: 0, aReceber: 0, atrasado: 0, parcelas: lista.length, parcelasAtrasadas: 0 }
  for (const p of lista) {
    const valor = Number(p.valor)
    r.total += valor
    const s = situacaoRecebimento(p, hoje)
    if (s === 'recebido') r.recebido += valor
    else {
      r.aReceber += valor
      if (s === 'atrasado') {
        r.atrasado += valor
        r.parcelasAtrasadas += 1
      }
    }
  }
  return r
}

// ---------------------------------------------------------------------------
// Plano de pagamento: percentuais que viram parcelas.
// ---------------------------------------------------------------------------
export type PlanoPadrao = { id: string; rotulo: string; percentuais: number[] }

export const PLANOS_PADRAO: PlanoPadrao[] = [
  { id: '40-30-30', rotulo: '40/30/30', percentuais: [40, 30, 30] },
  { id: '50-50', rotulo: '50/50', percentuais: [50, 50] },
  { id: '30-40-30', rotulo: '30/40/30', percentuais: [30, 40, 30] },
  { id: '4x', rotulo: '4x iguais', percentuais: [25, 25, 25, 25] },
  { id: 'avista', rotulo: 'À vista', percentuais: [100] },
]

export const NOMES_PARCELAS_3 = ['Entrada', 'Meio da obra', 'Entrega']

export function nomeParcela(i: number, total: number): string {
  if (total === 1) return 'Pagamento à vista'
  if (total === 2) return i === 0 ? 'Entrada' : 'Entrega'
  if (total === 3) return NOMES_PARCELAS_3[i]
  return i === 0 ? 'Entrada' : `Parcela ${i + 1} de ${total}`
}

// 'YYYY-MM-DD' + n meses, segurando o fim do mês (31/01 + 1 = 28/02).
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  const alvo = new Date(a, m - 1 + meses, 1)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(d, ultimo))
  const mm = String(alvo.getMonth() + 1).padStart(2, '0')
  const dd = String(alvo.getDate()).padStart(2, '0')
  return `${alvo.getFullYear()}-${mm}-${dd}`
}

export type ParcelaPlano = { descricao: string; percentual: number; valor: number; vencimento: string }

// Divide o total pelos percentuais, em centavos; a sobra do arredondamento
// fica na última parcela para a soma bater exatamente com o total.
export function gerarParcelas(total: number, percentuais: number[], primeiroVencimento: string): ParcelaPlano[] {
  const centavos = Math.round(total * 100)
  let usados = 0
  return percentuais.map((pct, i) => {
    const ultimo = i === percentuais.length - 1
    const parte = ultimo ? centavos - usados : Math.round((centavos * pct) / 100)
    usados += parte
    return {
      descricao: nomeParcela(i, percentuais.length),
      percentual: pct,
      valor: parte / 100,
      vencimento: somarMeses(primeiroVencimento, i),
    }
  })
}

// Primeiro e último dia do mês de 'YYYY-MM-DD'.
export function mesDe(hoje: string): { inicio: string; fim: string } {
  const inicio = `${hoje.slice(0, 7)}-01`
  const fim = somarMeses(inicio, 1)
  return { inicio, fim }
}
