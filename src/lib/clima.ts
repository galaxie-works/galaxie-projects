// Previsão do tempo pelo Open-Meteo (https://open-meteo.com): grátis, sem
// chave e sem cadastro. Se ele recusar (o limite diário é por IP, e o IP de
// saída da Vercel é compartilhado), cai para o MET Norway (api.met.no),
// também grátis e sem chave. Só roda no servidor; o resultado fica em cache
// por 1 hora.

export type TipoTempo = 'sol' | 'poucas-nuvens' | 'nublado' | 'neblina' | 'garoa' | 'chuva' | 'temporal' | 'neve'

/** Quanto a chuva atrapalha serviço externo nesse dia. */
export type RiscoChuva = 'seco' | 'talvez' | 'chuva'

export interface DiaPrevisao {
  /** 'YYYY-MM-DD' no fuso de São Paulo. */
  data: string
  tipo: TipoTempo
  descricao: string
  maxima: number
  minima: number
  /** Chance máxima de chuva no dia, 0 a 100. Nula quando a fonte não informa. */
  chanceChuva: number | null
  /** Chuva somada no dia, em mm. */
  chuvaMm: number
  risco: RiscoChuva
}

export interface Previsao {
  atual: { temperatura: number; tipo: TipoTempo; descricao: string } | null
  dias: DiaPrevisao[]
}

export interface CidadeClima {
  nome: string
  uf: string | null
  latitude: number
  longitude: number
}

// Códigos WMO usados pelo Open-Meteo.
function tipoDoCodigo(codigo: number): { tipo: TipoTempo; descricao: string } {
  if (codigo === 0) return { tipo: 'sol', descricao: 'Céu limpo' }
  if (codigo === 1 || codigo === 2) return { tipo: 'poucas-nuvens', descricao: 'Poucas nuvens' }
  if (codigo === 3) return { tipo: 'nublado', descricao: 'Nublado' }
  if (codigo === 45 || codigo === 48) return { tipo: 'neblina', descricao: 'Neblina' }
  if (codigo >= 51 && codigo <= 57) return { tipo: 'garoa', descricao: 'Garoa' }
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return { tipo: 'chuva', descricao: 'Chuva' }
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { tipo: 'neve', descricao: 'Neve' }
  if (codigo >= 95) return { tipo: 'temporal', descricao: 'Temporal' }
  return { tipo: 'nublado', descricao: 'Nublado' }
}

/**
 * Regra simples para obra externa (piso, fachada, telhado, concretagem):
 * chance de 60% ou mais, 5 mm ou mais, ou temporal = dia de chuva;
 * a partir de 30% ou 1 mm = pode chover.
 */
export function riscoDoDia(chance: number | null, mm: number, tipo: TipoTempo): RiscoChuva {
  const c = chance ?? 0
  if (tipo === 'temporal' || c >= 60 || mm >= 5) return 'chuva'
  if (c >= 30 || mm >= 1) return 'talvez'
  return 'seco'
}

interface RespostaPrevisao {
  current?: { temperature_2m: number; weather_code: number }
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: (number | null)[]
    precipitation_sum: (number | null)[]
  }
}

export async function buscarPrevisao(latitude: number, longitude: number, dias = 7): Promise<Previsao | null> {
  return (await previsaoOpenMeteo(latitude, longitude, dias)) ?? (await previsaoMetNorway(latitude, longitude, dias))
}

async function previsaoOpenMeteo(latitude: number, longitude: number, dias: number): Promise<Previsao | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', latitude.toFixed(4))
  url.searchParams.set('longitude', longitude.toFixed(4))
  url.searchParams.set('current', 'temperature_2m,weather_code')
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum'
  )
  url.searchParams.set('timezone', 'America/Sao_Paulo')
  url.searchParams.set('forecast_days', String(dias))

  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const json = (await res.json()) as RespostaPrevisao
    const d = json.daily
    if (!d) return null
    const lista: DiaPrevisao[] = d.time.map((data, i) => {
      const { tipo, descricao } = tipoDoCodigo(d.weather_code[i])
      const chanceChuva = Math.round(d.precipitation_probability_max[i] ?? 0)
      const chuvaMm = Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10
      return {
        data,
        tipo,
        descricao,
        maxima: Math.round(d.temperature_2m_max[i]),
        minima: Math.round(d.temperature_2m_min[i]),
        chanceChuva,
        chuvaMm,
        risco: riscoDoDia(chanceChuva, chuvaMm, tipo),
      }
    })
    const atual = json.current
      ? { temperatura: Math.round(json.current.temperature_2m), ...tipoDoCodigo(json.current.weather_code) }
      : null
    return { atual, dias: lista }
  } catch {
    return null
  }
}

// ---- MET Norway (reserva) ---------------------------------------------------

interface PassoMet {
  time: string
  data: {
    instant: { details: { air_temperature?: number } }
    next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } }
    next_6_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } }
  }
}

// Ordem de gravidade para escolher o "tempo do dia" entre as horas.
const GRAVIDADE: TipoTempo[] = ['sol', 'poucas-nuvens', 'nublado', 'neblina', 'garoa', 'neve', 'chuva', 'temporal']
const DESCRICAO: Record<TipoTempo, string> = {
  sol: 'Céu limpo',
  'poucas-nuvens': 'Poucas nuvens',
  nublado: 'Nublado',
  neblina: 'Neblina',
  garoa: 'Garoa',
  chuva: 'Chuva',
  temporal: 'Temporal',
  neve: 'Neve',
}

function tipoDoSimbolo(simbolo: string): TipoTempo {
  const s = simbolo.replace(/_(day|night|polartwilight)$/, '')
  if (s.includes('thunder')) return 'temporal'
  if (s.includes('snow') || s.includes('sleet')) return 'neve'
  if (s.startsWith('lightrain')) return 'garoa'
  if (s.includes('rain')) return 'chuva'
  if (s === 'fog') return 'neblina'
  if (s === 'cloudy') return 'nublado'
  if (s === 'partlycloudy' || s === 'fair') return 'poucas-nuvens'
  return 'sol'
}

const diaSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })

async function previsaoMetNorway(latitude: number, longitude: number, dias: number): Promise<Previsao | null> {
  // A MET pede no máximo 4 casas decimais e um User-Agent que identifique o app.
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact')
  url.searchParams.set('lat', latitude.toFixed(4))
  url.searchParams.set('lon', longitude.toFixed(4))
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'galaxie-obras/1.0 github.com/galaxie-works/galaxie-projects' },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { properties?: { timeseries?: PassoMet[] } }
    const passos = json.properties?.timeseries ?? []
    if (passos.length === 0) return null

    const porDia = new Map<string, { temps: number[]; mm: number; tipo: TipoTempo }>()
    for (const p of passos) {
      const data = diaSP.format(new Date(p.time))
      const dia = porDia.get(data) ?? { temps: [], mm: 0, tipo: 'sol' as TipoTempo }
      const t = p.data.instant.details.air_temperature
      if (typeof t === 'number') dia.temps.push(t)
      // Na parte horária usa a próxima hora; depois, os blocos de 6 horas.
      const bloco = p.data.next_1_hours ?? p.data.next_6_hours
      if (bloco) {
        dia.mm += bloco.details.precipitation_amount ?? 0
        const tipo = tipoDoSimbolo(bloco.summary.symbol_code)
        if (GRAVIDADE.indexOf(tipo) > GRAVIDADE.indexOf(dia.tipo)) dia.tipo = tipo
      }
      porDia.set(data, dia)
    }

    const lista: DiaPrevisao[] = [...porDia.entries()]
      .filter(([, d]) => d.temps.length > 0)
      .slice(0, dias)
      .map(([data, d]) => {
        const chuvaMm = Math.round(d.mm * 10) / 10
        return {
          data,
          tipo: d.tipo,
          descricao: DESCRICAO[d.tipo],
          maxima: Math.round(Math.max(...d.temps)),
          minima: Math.round(Math.min(...d.temps)),
          chanceChuva: null,
          chuvaMm,
          risco: riscoDoDia(null, chuvaMm, d.tipo),
        }
      })

    const primeiro = passos[0]
    const simbolo = primeiro.data.next_1_hours?.summary.symbol_code ?? primeiro.data.next_6_hours?.summary.symbol_code
    const tAtual = primeiro.data.instant.details.air_temperature
    const atual =
      typeof tAtual === 'number' && simbolo
        ? { temperatura: Math.round(tAtual), tipo: tipoDoSimbolo(simbolo), descricao: DESCRICAO[tipoDoSimbolo(simbolo)] }
        : null
    return { atual, dias: lista }
  } catch {
    return null
  }
}

const UF_POR_ESTADO: Record<string, string> = {
  Acre: 'AC',
  Alagoas: 'AL',
  Amapá: 'AP',
  Amazonas: 'AM',
  Bahia: 'BA',
  Ceará: 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  Goiás: 'GO',
  Maranhão: 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  Pará: 'PA',
  Paraíba: 'PB',
  Paraná: 'PR',
  Pernambuco: 'PE',
  Piauí: 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  Rondônia: 'RO',
  Roraima: 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  Sergipe: 'SE',
  Tocantins: 'TO',
}

const ESTADO_POR_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_POR_ESTADO).map(([estado, uf]) => [uf, estado])
)

interface RespostaGeocodificacao {
  results?: { name: string; latitude: number; longitude: number; admin1?: string; feature_code?: string }[]
}

/** Procura cidades brasileiras pelo nome (aceita "Campinas" ou "Campinas, SP"). */
export async function buscarCidades(termo: string): Promise<CidadeClima[]> {
  const [nomeBruto, ufBruta] = termo.split(/[,/-]/).map((p) => p.trim())
  const nome = nomeBruto ?? ''
  if (nome.length < 2) return []
  const uf = ufBruta?.toUpperCase()

  const cidades = (await cidadesOpenMeteo(nome)) ?? (await cidadesNominatim(nome)) ?? []
  const filtradas = uf && ESTADO_POR_UF[uf] ? cidades.filter((c) => c.uf === uf) : cidades
  return filtradas.slice(0, 6)
}

/** null = serviço fora (para tentar o próximo); [] = não achou. */
async function cidadesOpenMeteo(nome: string): Promise<CidadeClima[] | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', nome)
  url.searchParams.set('count', '10')
  url.searchParams.set('language', 'pt')
  url.searchParams.set('countryCode', 'BR')
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const json = (await res.json()) as RespostaGeocodificacao
    return (json.results ?? []).map((r) => ({
      nome: r.name,
      uf: (r.admin1 && UF_POR_ESTADO[r.admin1]) || null,
      latitude: r.latitude,
      longitude: r.longitude,
    }))
  } catch {
    return null
  }
}

interface ResultadoNominatim {
  lat: string
  lon: string
  name: string
  addresstype?: string
  address?: { state?: string }
}

// Reserva: Nominatim (OpenStreetMap), grátis, pede User-Agent e uso leve
// (só roda quando alguém procura a cidade).
async function cidadesNominatim(nome: string): Promise<CidadeClima[] | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('city', nome)
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '10')
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'galaxie-obras/1.0 github.com/galaxie-works/galaxie-projects', 'Accept-Language': 'pt-BR' },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as ResultadoNominatim[]
    const vistas = new Set<string>()
    const cidades: CidadeClima[] = []
    for (const r of json) {
      const uf = (r.address?.state && UF_POR_ESTADO[r.address.state]) || null
      const chave = `${r.name}|${uf}`
      if (vistas.has(chave)) continue
      vistas.add(chave)
      cidades.push({ nome: r.name, uf, latitude: Number(r.lat), longitude: Number(r.lon) })
    }
    return cidades
  } catch {
    return null
  }
}

/** Rótulo curto do dia: "Hoje" ou "sáb". */
export function rotuloDiaCurto(data: string, hoje: string): string {
  if (data === hoje) return 'Hoje'
  const [a, m, d] = data.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(a, m - 1, d)))
    .replace('.', '')
}
