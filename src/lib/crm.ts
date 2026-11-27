import type { Cliente, FaseCliente, FaseNegocio, Projeto } from '@/types'

type ObraResumo = Pick<Projeto, 'status' | 'orcamento_total'>
type NegocioResumo = { fase: FaseNegocio }

const NEGOCIO_PROSPECT: FaseNegocio[] = ['novo', 'visita_agendada', 'medicao']
const NEGOCIO_PROPOSTA: FaseNegocio[] = ['orcamento_enviado', 'negociacao']
const NEGOCIO_FECHADO: FaseNegocio[] = ['contrato_assinado', 'ganho']

// Fase automática pelo que está mais avançado entre obras e negócios:
// obra em execução/pausada ou contrato fechado = cliente; obra em
// planejamento ou orçamento enviado = proposta; negócio no começo do funil =
// prospect; só obras completas = pós-venda; nada = lead. Negócios perdidos
// não contam.
export function faseAutomatica(obras: ObraResumo[], negocios: NegocioResumo[] = []): FaseCliente {
  const temNegocio = (fases: FaseNegocio[]) => negocios.some((n) => fases.includes(n.fase))
  if (obras.some((o) => o.status === 'em_execucao' || o.status === 'pausado')) return 'cliente'
  if (temNegocio(NEGOCIO_FECHADO) && !obras.every((o) => o.status === 'completo')) return 'cliente'
  if (obras.some((o) => o.status === 'planejamento') || temNegocio(NEGOCIO_PROPOSTA)) return 'proposta'
  if (temNegocio(NEGOCIO_PROSPECT)) return 'prospect'
  if (obras.some((o) => o.status === 'completo')) return 'pos_venda'
  if (temNegocio(NEGOCIO_FECHADO)) return 'cliente'
  return 'lead'
}

// O ajuste manual sempre vence a fase calculada.
export function faseDoCliente(
  cliente: Pick<Cliente, 'fase_manual'>,
  obras: ObraResumo[],
  negocios: NegocioResumo[] = []
): FaseCliente {
  return cliente.fase_manual ?? faseAutomatica(obras, negocios)
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

// Link do WhatsApp a partir do telefone salvo (só dígitos, com DDI 55),
// opcionalmente com a mensagem já escrita.
export function linkWhatsApp(telefone: string | null, texto?: string): string | null {
  if (!telefone) return null
  let digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 0) return null
  if (digitos.length <= 11) digitos = `55${digitos}`
  return texto ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : `https://wa.me/${digitos}`
}

export function hojeISO(): string {
  // 'YYYY-MM-DD' no fuso de Brasília, para não depender do fuso do servidor.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Hora do servidor em ms, para cálculos de "há quantos dias" iguais nos dois lados. */
export function agoraMs(): number {
  return Date.now()
}
