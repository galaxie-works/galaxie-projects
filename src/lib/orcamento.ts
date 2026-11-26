// Orçamento por área: unidades de cobrança, cálculo dos totais, conta de
// medidas ("5,2 x 3,4 + 2 x 1,5") e leitura de medidas ditadas por voz.
//
// O formato `AreaOrcamento[]` é o mesmo que a função salvar_orcamento do
// banco recebe (ver supabase/schema.sql), então a tela, o ditado e um
// assistente de IA podem produzir o orçamento do mesmo jeito.

import { SERVICOS_POR_ID, encontrarServicosNoTexto } from '@/lib/servicos'

export type Unidade = 'm2' | 'ml' | 'un' | 'm3' | 'vb' | 'dia'

export const UNIDADES: Record<Unidade, { curto: string; nome: string; plural: string }> = {
  m2: { curto: 'm²', nome: 'Metro quadrado', plural: 'metros quadrados' },
  ml: { curto: 'm', nome: 'Metro linear', plural: 'metros lineares' },
  un: { curto: 'un', nome: 'Unidade', plural: 'unidades' },
  m3: { curto: 'm³', nome: 'Metro cúbico', plural: 'metros cúbicos' },
  vb: { curto: 'vb', nome: 'Verba (preço fechado)', plural: 'verbas' },
  dia: { curto: 'dia', nome: 'Diária', plural: 'diárias' },
}

export const LISTA_UNIDADES = (Object.keys(UNIDADES) as Unidade[]).map((u) => ({
  value: u,
  label: `${UNIDADES[u].nome} (${UNIDADES[u].curto})`,
}))

export type ItemOrcamento = {
  /** Só para a tela (chave do React); não vai para o banco. */
  chave: string
  servico_id: string | null
  descricao: string | null
  unidade: Unidade
  quantidade: number
  memoria_calculo: string | null
  preco_unitario: number
}

export type AreaOrcamento = {
  chave: string
  nome: string
  observacao: string | null
  itens: ItemOrcamento[]
}

export type PrecoServico = { unidade: Unidade; preco: number }
export type TabelaPrecos = Record<string, PrecoServico>

// Unidade sugerida quando a empresa ainda não definiu a do serviço.
const UNIDADE_POR_SERVICO: Record<string, Unidade> = {
  'rodapes-soleiras': 'ml',
  'calhas-rufos': 'ml',
  sanca: 'ml',
  'guarda-corpo': 'ml',
  'cerca-eletrica': 'ml',
  'escadas-pedra': 'ml',
  muro: 'ml',
  rejuntamento: 'm2',
  bancadas: 'un',
  'portas-janelas': 'un',
  'portas-madeira': 'un',
  'portao-automatico': 'un',
  'loucas-metais': 'un',
  'ar-condicionado': 'un',
  'quadro-disjuntores': 'un',
  'padrao-entrada': 'un',
  'carregador-veicular': 'un',
  'caixa-dagua': 'un',
  aquecedor: 'un',
  coifas: 'un',
  'montagem-moveis': 'un',
  'moveis-planejados': 'un',
  cftv: 'un',
  concretagem: 'm3',
  terraplanagem: 'm3',
  'remocao-entulho': 'm3',
}
const UNIDADE_POR_CATEGORIA: Record<string, Unidade> = {
  preliminares: 'vb',
  'fundacao-estrutura': 'm3',
  eletrica: 'vb',
  hidraulica: 'vb',
  gas: 'vb',
  climatizacao: 'un',
  'energia-solar': 'vb',
  'automacao-seguranca': 'vb',
  projetos: 'vb',
}

export function unidadePadrao(servicoId: string | null | undefined): Unidade {
  if (!servicoId) return 'm2'
  if (UNIDADE_POR_SERVICO[servicoId]) return UNIDADE_POR_SERVICO[servicoId]
  const categoria = SERVICOS_POR_ID[servicoId]?.categoria.id
  return (categoria && UNIDADE_POR_CATEGORIA[categoria]) || 'm2'
}

export function nomeServico(item: Pick<ItemOrcamento, 'servico_id' | 'descricao'>): string {
  return (
    (item.servico_id && SERVICOS_POR_ID[item.servico_id]?.servico.nome) ||
    item.descricao ||
    'Serviço'
  )
}

export function novaChave(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function novoItem(servicoId: string | null, precos: TabelaPrecos): ItemOrcamento {
  const preco = servicoId ? precos[servicoId] : undefined
  return {
    chave: novaChave(),
    servico_id: servicoId,
    descricao: null,
    unidade: preco?.unidade ?? unidadePadrao(servicoId),
    quantidade: 0,
    memoria_calculo: null,
    preco_unitario: preco?.preco ?? 0,
  }
}

export function novaArea(nome = ''): AreaOrcamento {
  return { chave: novaChave(), nome, observacao: null, itens: [] }
}

// Cálculo ---------------------------------------------------------------------

const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas

/**
 * Quantidade (3 casas) × preço (2 casas) com arredondamento "meio para
 * cima" em centavos, feito em inteiros para bater com o round(numeric, 2)
 * do Postgres (0,5 × R$ 2,01 = R$ 1,01, não R$ 1,00).
 */
export function totalItem(item: ItemOrcamento): number {
  const milesimos = Math.round(item.quantidade * 1000)
  const centavos = Math.round(item.preco_unitario * 100)
  return Math.floor((milesimos * centavos + 500) / 1000) / 100
}

export function totalArea(area: AreaOrcamento): number {
  return arred(area.itens.reduce((s, i) => s + totalItem(i), 0))
}

export function quantidadePorUnidade(
  areas: AreaOrcamento[] | AreaOrcamento,
): Partial<Record<Unidade, number>> {
  const lista = Array.isArray(areas) ? areas : [areas]
  const r: Partial<Record<Unidade, number>> = {}
  for (const a of lista)
    for (const i of a.itens) r[i.unidade] = arred((r[i.unidade] ?? 0) + i.quantidade, 3)
  return r
}

export type LinhaServico = {
  chave: string
  nome: string
  unidade: Unidade
  quantidade: number
  total: number
}

/** Total por serviço (ex.: "Cerâmica e porcelanato 164,70 m² → R$ 23.058,00"). */
export function totaisPorServico(areas: AreaOrcamento[]): LinhaServico[] {
  const mapa = new Map<string, LinhaServico>()
  for (const a of areas)
    for (const i of a.itens) {
      const chave = `${i.servico_id ?? i.descricao ?? ''}|${i.unidade}`
      const atual = mapa.get(chave) ?? {
        chave,
        nome: nomeServico(i),
        unidade: i.unidade,
        quantidade: 0,
        total: 0,
      }
      atual.quantidade = arred(atual.quantidade + i.quantidade, 3)
      atual.total = arred(atual.total + totalItem(i))
      mapa.set(chave, atual)
    }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function totalOrcamento(areas: AreaOrcamento[]): number {
  return arred(areas.reduce((s, a) => s + totalArea(a), 0))
}

/** Remove áreas sem nome e sem itens e itens sem serviço, antes de salvar. */
export function limparOrcamento(areas: AreaOrcamento[]) {
  return areas
    .map((a) => ({ ...a, itens: a.itens.filter((i) => i.servico_id || i.descricao) }))
    .filter((a) => a.nome.trim() || a.itens.length > 0)
}

/** Formato aceito por rpc('salvar_orcamento'). */
export function paraBanco(areas: AreaOrcamento[]) {
  return limparOrcamento(areas).map((a) => ({
    nome: a.nome.trim(),
    observacao: a.observacao,
    itens: a.itens.map((i) => ({
      servico_id: i.servico_id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      memoria_calculo: i.memoria_calculo,
      preco_unitario: i.preco_unitario,
    })),
  }))
}

type LinhaArea = { id: string; nome: string; observacao: string | null; ordem: number }
type LinhaItem = {
  area_id: string
  servico_id: string | null
  descricao: string | null
  unidade: Unidade
  quantidade: number | string
  memoria_calculo: string | null
  preco_unitario: number | string
  ordem: number
}

/** Monta o orçamento a partir das linhas de projeto_areas e projeto_itens. */
export function doBanco(areas: LinhaArea[], itens: LinhaItem[]): AreaOrcamento[] {
  return [...areas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((a) => ({
      chave: a.id,
      nome: a.nome,
      observacao: a.observacao,
      itens: itens
        .filter((i) => i.area_id === a.id)
        .sort((x, y) => x.ordem - y.ordem)
        .map((i) => ({
          chave: novaChave(),
          servico_id: i.servico_id,
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: Number(i.quantidade),
          memoria_calculo: i.memoria_calculo,
          preco_unitario: Number(i.preco_unitario),
        })),
    }))
}

// Formatação ------------------------------------------------------------------

export function formatarQuantidade(valor: number, unidade?: Unidade): string {
  const n = valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return unidade ? `${n} ${UNIDADES[unidade].curto}` : n
}

// Conta de medidas ------------------------------------------------------------

/**
 * Avalia uma conta simples de medidas em formato brasileiro:
 * "71,11", "5,2 x 3,4", "5,2 x 3,4 + 2 x 1,5 - 0,8". Aceita x, × e * para
 * multiplicar e parênteses não. Devolve null se não der para entender.
 */
export function avaliarMedida(texto: string): number | null {
  const limpo = texto
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×|\*|por/g, 'x')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // 1.234,5 -> 1234,5
    .replace(/,/g, '.')
  if (!limpo) return null
  if (!/^[\d.x+-]+$/.test(limpo)) return null
  let total = 0
  for (const termo of limpo.match(/[+-]?[^+-]+/g) ?? []) {
    const sinal = termo.startsWith('-') ? -1 : 1
    const fatores = termo.replace(/^[+-]/, '').split('x')
    let produto = 1
    for (const f of fatores) {
      if (!/^\d*\.?\d+$/.test(f)) return null
      produto *= Number(f)
    }
    total += sinal * produto
  }
  return total < 0 ? null : arred(total, 3)
}

export function ehConta(texto: string): boolean {
  return /\d\s*[x×*+-]\s*\d/i.test(texto)
}

// Ditado de medidas -----------------------------------------------------------

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const PADROES_UNIDADE: [RegExp, Unidade][] = [
  [/\b(metros? quadrados?|m2|m²|metragem quadrada)\b/, 'm2'],
  [/\b(metros? cubicos?|m3|m³)\b/, 'm3'],
  [/\b(metros? lineares?|metro linear|ml|metros?|m)\b/, 'ml'],
  [/\b(unidades?|pecas?|un|pontos?)\b/, 'un'],
  [/\b(diarias?|dias?)\b/, 'dia'],
  [/\b(verba|preco fechado|empreitada)\b/, 'vb'],
]

const NUMEROS_POR_EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  quinze: 15,
  vinte: 20,
  trinta: 30,
}

export type ItemDitado = {
  servico_id: string
  unidade: Unidade
  quantidade: number
  memoria_calculo: string | null
  preco_unitario: number | null
}

/**
 * Lê uma fala como "71,11 metros quadrados de porcelanato e 20,79 metros de
 * rodapé" ou "porcelanato 5 por 3,2 e rodapé 16 metros a 50 reais" e devolve
 * os itens. Só usa serviços da empresa; quando a fala não cita o serviço,
 * escolhe o primeiro serviço da empresa cobrado naquela unidade.
 */
export function lerMedidasDitadas(
  texto: string,
  servicosEmpresa: string[],
  precos: TabelaPrecos,
): ItemDitado[] {
  const norm = normalizar(texto)
    .replace(/(\d)\s*virgula\s*(\d)/g, '$1,$2')
    .replace(/(\d)\s*ponto\s*(\d)/g, '$1,$2')
    .replace(
      /\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta)\b(?=\s+(metros?|m|unidades?|pecas?|diarias?|dias?|por|x)\b)/g,
      (p) => String(NUMEROS_POR_EXTENSO[p]),
    )
    .replace(/(\d)\s+(?:por|vezes)\s+(\d)/g, '$1x$2')

  // Um trecho por serviço: quebra em " e ", ";" e vírgula seguida de espaço
  // (a vírgula decimal vem colada no número).
  const trechos = norm
    .split(/\s+e\s+|;|,\s+|\.\s+|\n/)
    .map((t) => t.trim())
    .filter(Boolean)
  const itens: ItemDitado[] = []
  for (const trecho of trechos) {
    const precoMatch = trecho.match(
      /(?:a|por|de)?\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:reais|real|r\$)/,
    )
    const preco = precoMatch ? Number(precoMatch[1].replace(',', '.')) : null
    const semPreco = precoMatch ? trecho.replace(precoMatch[0], ' ') : trecho

    const conta = semPreco.match(/\d+(?:,\d+)?(?:\s*[x+-]\s*\d+(?:,\d+)?)*/)
    if (!conta) continue
    const quantidade = avaliarMedida(conta[0])
    if (quantidade === null || quantidade === 0) continue

    let unidade: Unidade | null = null
    const resto = semPreco.replace(conta[0], ' ')
    for (const [re, u] of PADROES_UNIDADE)
      if (re.test(resto)) {
        unidade = u
        break
      }
    if (!unidade && /x/.test(conta[0])) unidade = 'm2'

    const citados = encontrarServicosNoTexto(semPreco).filter((id) => servicosEmpresa.includes(id))
    const unidadeDe = (id: string) => precos[id]?.unidade ?? unidadePadrao(id)
    const servico =
      (unidade ? citados.find((id) => unidadeDe(id) === unidade) : undefined) ??
      citados[0] ??
      (unidade ? servicosEmpresa.find((id) => unidadeDe(id) === unidade) : undefined) ??
      (servicosEmpresa.length === 1 ? servicosEmpresa[0] : undefined)
    if (!servico) continue

    itens.push({
      servico_id: servico,
      unidade: unidade ?? unidadeDe(servico),
      quantidade,
      memoria_calculo: ehConta(conta[0]) ? conta[0].replace(/\s*([x+-])\s*/g, ' $1 ') : null,
      preco_unitario: preco,
    })
  }
  return itens
}

/** Sugestões de nomes de área para adicionar com um toque. */
export const AREAS_SUGERIDAS = [
  'Sala',
  'Cozinha',
  'Banheiro',
  'Quarto',
  'Área de serviço',
  'Varanda',
  'Garagem',
  'Área da piscina',
  'Escada',
  'Fachada',
]
