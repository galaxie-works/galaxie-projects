import { SERVICOS_POR_ID } from '@/lib/servicos'

export type Membro = { id: string; nome: string; funcao: string }
export type ModoTrabalho = 'sozinho' | 'equipe'

export type Rascunho = {
  etapa: number
  nome: string
  cnpj: string
  descricao: string
  areas: string[]
  servicos: string[]
  modo: ModoTrabalho
  equipe: Membro[]
  processo: string
}

export const RASCUNHO_INICIAL: Rascunho = {
  etapa: 1,
  nome: '',
  cnpj: '',
  descricao: '',
  areas: [],
  servicos: [],
  modo: 'sozinho',
  equipe: [],
  processo: '',
}

export const TOTAL_ETAPAS = 5

const CHAVE = 'galaxie:onboarding:rascunho'

export function lerRascunho(): Rascunho | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE)
    if (!bruto) return null
    const dados = JSON.parse(bruto) as Partial<Rascunho>
    return { ...RASCUNHO_INICIAL, ...dados }
  } catch {
    return null
  }
}

export function salvarRascunho(r: Rascunho) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(r))
  } catch {
    // modo privado ou armazenamento cheio: segue sem rascunho
  }
}

export function apagarRascunho() {
  try {
    window.localStorage.removeItem(CHAVE)
  } catch {
    // idem
  }
}

/** 00.000.000/0000-00, aplicada enquanto a pessoa digita. */
export function mascararCnpj(texto: string) {
  const d = texto.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function cnpjValido(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  return d.length === 0 || d.length === 14
}

/** Serviços que pertencem às áreas marcadas (os de áreas desmarcadas ficam de fora). */
export function servicosEfetivos(r: Pick<Rascunho, 'areas' | 'servicos'>) {
  return r.servicos.filter((id) => {
    const area = SERVICOS_POR_ID[id]?.area.id
    return area !== undefined && r.areas.includes(area)
  })
}

export function membrosValidos(r: Pick<Rascunho, 'modo' | 'equipe'>) {
  if (r.modo !== 'equipe') return []
  return r.equipe
    .map((m) => ({ ...m, nome: m.nome.trim(), funcao: m.funcao.trim() }))
    .filter((m) => m.nome)
}

/** Primeira etapa que ainda não está completa (TOTAL_ETAPAS se todas estiverem). */
export function etapaMaximaLiberada(r: Rascunho) {
  if (!r.nome.trim() || !cnpjValido(r.cnpj)) return 1
  if (r.areas.length === 0) return 2
  if (servicosEfetivos(r).length === 0) return 3
  return TOTAL_ETAPAS
}
