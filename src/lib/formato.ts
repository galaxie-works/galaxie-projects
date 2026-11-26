export function formatarMoeda(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Datas do banco vêm como 'YYYY-MM-DD'; evita o deslocamento de fuso.
export function formatarData(data: string | null | undefined): string {
  if (!data) return '—'
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

// Data de um timestamp (timestamptz) no fuso de Brasília, para um contato às
// 23h não aparecer como o dia seguinte.
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  if (iso.length <= 10) return formatarData(iso)
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}
