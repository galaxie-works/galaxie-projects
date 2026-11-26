import type { Cliente, FaseCliente, Projeto } from '@/types'

type ObraResumo = Pick<Projeto, 'status' | 'orcamento_total'>

// Fase automática enquanto não existe a tabela de negócios (fase 2 do plano):
// obra em execução ou pausada = cliente; em planejamento = proposta;
// só obras completas = pós-venda; sem obra = lead.
export function faseAutomatica(obras: ObraResumo[]): FaseCliente {
  if (obras.some((o) => o.status === 'em_execucao' || o.status === 'pausado')) return 'cliente'
  if (obras.some((o) => o.status === 'planejamento')) return 'proposta'
  if (obras.some((o) => o.status === 'completo')) return 'pos_venda'
  return 'lead'
}

// O ajuste manual sempre vence a fase calculada.
export function faseDoCliente(cliente: Pick<Cliente, 'fase_manual'>, obras: ObraResumo[]): FaseCliente {
  return cliente.fase_manual ?? faseAutomatica(obras)
}

export type NumerosCliente = {
  contratado: number
  emProposta: number
  obrasAtivas: number
  totalObras: number
}

export function numerosDoCliente(obras: ObraResumo[]): NumerosCliente {
  let contratado = 0
  let emProposta = 0
  let obrasAtivas = 0
  for (const o of obras) {
    const valor = Number(o.orcamento_total ?? 0)
    if (o.status === 'planejamento') emProposta += valor
    else contratado += valor
    if (o.status === 'em_execucao' || o.status === 'pausado') obrasAtivas += 1
  }
  return { contratado, emProposta, obrasAtivas, totalObras: obras.length }
}

// Situação do follow-up em relação a hoje ('YYYY-MM-DD').
export function situacaoFollowup(
  data: string | null,
  hoje: string
): 'sem' | 'atrasado' | 'hoje' | 'futuro' {
  if (!data) return 'sem'
  const d = data.slice(0, 10)
  if (d < hoje) return 'atrasado'
  if (d === hoje) return 'hoje'
  return 'futuro'
}

// Link do WhatsApp a partir do telefone salvo (só dígitos, com DDI 55).
export function linkWhatsApp(telefone: string | null): string | null {
  if (!telefone) return null
  let digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 0) return null
  if (digitos.length <= 11) digitos = `55${digitos}`
  return `https://wa.me/${digitos}`
}

export function hojeISO(): string {
  // 'YYYY-MM-DD' no fuso de Brasília, para não depender do fuso do servidor.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
