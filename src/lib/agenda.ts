// Datas da agenda sempre no fuso de Brasília, independente do fuso do
// servidor ou do aparelho. O Brasil não tem horário de verão desde 2019,
// então o deslocamento é fixo em -03:00.

const FUSO = 'America/Sao_Paulo'
const DESLOCAMENTO = '-03:00'

/** 'YYYY-MM-DD' de um timestamp, no fuso de Brasília. */
export function diaDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(iso))
}

/** 'HH:mm' de um timestamp, no fuso de Brasília. */
export function horaDe(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** Timestamp ISO a partir de dia 'YYYY-MM-DD' e hora 'HH:mm' de Brasília. */
export function montarPrevisto(dia: string, hora: string): string {
  const h = /^\d{2}:\d{2}$/.test(hora) ? hora : '09:00'
  return new Date(`${dia}T${h}:00${DESLOCAMENTO}`).toISOString()
}

/** Início do dia (00:00 de Brasília) como ISO, para filtros no banco. */
export function inicioDoDia(dia: string): string {
  return new Date(`${dia}T00:00:00${DESLOCAMENTO}`).toISOString()
}

/** true se 'YYYY-MM-DD' é uma data de calendário que existe (ex.: não 2026-02-31). */
export function diaValido(dia: string | null | undefined): dia is string {
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false
  const [a, m, d] = dia.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d
}

/** Soma dias a 'YYYY-MM-DD' sem passar por fuso. */
export function somarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d + dias))
  return data.toISOString().slice(0, 10)
}

/** Segunda-feira da semana de 'YYYY-MM-DD'. */
export function inicioDaSemana(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay() // 0 = domingo
  return somarDias(dia, semana === 0 ? -6 : 1 - semana)
}

/** Ex.: "qui., 27 de nov." */
export function rotuloDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Ex.: "quinta-feira, 27 de novembro" */
export function rotuloDiaLongo(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export type SituacaoTarefa = 'concluida' | 'atrasada' | 'hoje' | 'futura'

export function situacaoTarefa(
  t: { previsto_para: string; concluida_em?: string | null },
  hoje: string
): SituacaoTarefa {
  if (t.concluida_em) return 'concluida'
  const dia = diaDe(t.previsto_para)
  if (dia < hoje) return 'atrasada'
  if (dia === hoje) return 'hoje'
  return 'futura'
}

/** Atalhos de prazo do próximo passo. */
export const ATALHOS_PRAZO = [
  { rotulo: 'Amanhã', dias: 1 },
  { rotulo: 'Em 3 dias', dias: 3 },
  { rotulo: 'Em 1 semana', dias: 7 },
  { rotulo: 'Em 15 dias', dias: 15 },
] as const

/** Tipos que fazem sentido como próximo passo agendado. */
export const TIPOS_PROXIMO_PASSO = ['ligacao', 'whatsapp', 'visita', 'reuniao', 'email', 'tarefa'] as const
