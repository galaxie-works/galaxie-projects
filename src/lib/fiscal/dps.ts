// Monta o XML da DPS (Declaração de Prestação de Serviço) do padrão nacional
// da NFS-e, leiaute 1.01. A ordem dos elementos segue o XSD oficial
// (tiposComplexos_v1.01.xsd). A DPS sai sem assinatura: ver assinatura.ts.

export const NS_NFSE = 'http://www.sped.fazenda.gov.br/nfse'
export const VERSAO_LEIAUTE = '1.01'
export const VERSAO_APLICATIVO = 'GalaxieObras1.0'

export type Ambiente = 'homologacao' | 'producao'

export type EnderecoNacional = {
  cep: string // 8 dígitos
  codigoMunicipio: string // IBGE, 7 dígitos
  logradouro: string
  numero: string
  complemento?: string | null
  bairro: string
}

export type DadosDps = {
  ambiente: Ambiente
  emitidaEm: Date
  competencia: string // AAAA-MM-DD
  serie: string
  numero: number
  prestador: {
    documento: string // CNPJ (14) ou CPF (11)
    inscricaoMunicipal?: string | null
    telefone?: string | null
    email?: string | null
    codigoMunicipio: string // município do prestador (cLocEmi)
    opcaoSimples: '1' | '2' | '3' // 1 não optante, 2 MEI, 3 ME/EPP
    regimeApuracaoSimples?: '1' | '2' | '3' | null
    regimeEspecial: string // 0 nenhum
  }
  tomador?: {
    documento: string
    nome: string
    endereco?: EnderecoNacional | null
    telefone?: string | null
    email?: string | null
  } | null
  servico: {
    codigoMunicipioPrestacao: string
    codigoTributacaoNacional: string // 6 dígitos, ex. 070201
    codigoTributacaoMunicipal?: string | null // 3 dígitos
    descricao: string
    codigoNbs?: string | null
    obra?: {
      cno?: string | null
      inscricaoImobiliaria?: string | null
      endereco?: { cep: string; logradouro: string; numero: string; complemento?: string | null; bairro: string } | null
    } | null
    informacoesComplementares?: string | null
  }
  valores: {
    valorServico: number
    descontoIncondicionado?: number | null
    tributacaoIssqn: '1' | '2' | '3' | '4'
    retencaoIssqn: '1' | '2' | '3' // 1 não retido, 2 retido pelo tomador
    aliquotaIssqn?: number | null // %, só quando a prefeitura pede
    percentualTributosSimples?: number | null
  }
}

const so = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')

function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function el(nome: string, conteudo: string | number | null | undefined): string {
  if (conteudo === null || conteudo === undefined || conteudo === '') return ''
  return `<${nome}>${typeof conteudo === 'number' ? conteudo : esc(String(conteudo).trim())}</${nome}>`
}

function grupo(nome: string, ...filhos: string[]): string {
  const dentro = filhos.join('')
  return dentro ? `<${nome}>${dentro}</${nome}>` : ''
}

const dec2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

// Horário de Brasília (sem horário de verão desde 2019), no formato do XSD.
// Recua um minuto para a Sefin não recusar por "emissão no futuro".
export function dataHoraBrasilia(data: Date): string {
  const t = new Date(data.getTime() - 60_000 - 3 * 3600_000)
  return t.toISOString().slice(0, 19) + '-03:00'
}

export function hojeBrasilia(data = new Date()): string {
  return new Date(data.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

function documento(doc: string): string {
  const d = so(doc)
  return d.length === 11 ? el('CPF', d) : el('CNPJ', d)
}

// Id da DPS: "DPS" + município (7) + tipo de inscrição (1 CPF, 2 CNPJ) +
// inscrição (14) + série (5) + número (15) = 45 posições.
export function idDps(codigoMunicipio: string, doc: string, serie: string, numero: number): string {
  const d = so(doc)
  const tipo = d.length === 11 ? '1' : '2'
  return (
    'DPS' +
    so(codigoMunicipio).padStart(7, '0') +
    tipo +
    d.padStart(14, '0') +
    so(serie).padStart(5, '0') +
    String(numero).padStart(15, '0')
  )
}

function endereco(e: EnderecoNacional): string {
  return grupo(
    'end',
    grupo('endNac', el('cMun', so(e.codigoMunicipio)), el('CEP', so(e.cep))),
    el('xLgr', e.logradouro),
    el('nro', e.numero || 'S/N'),
    el('xCpl', e.complemento),
    el('xBairro', e.bairro),
  )
}

export function montarDps(d: DadosDps): { xml: string; id: string } {
  const id = idDps(d.prestador.codigoMunicipio, d.prestador.documento, d.serie, d.numero)
  const p = d.prestador
  const t = d.tomador
  const s = d.servico
  const v = d.valores

  const prest = grupo(
    'prest',
    documento(p.documento),
    el('IM', p.inscricaoMunicipal),
    el('fone', so(p.telefone) || null),
    el('email', p.email),
    grupo(
      'regTrib',
      el('opSimpNac', p.opcaoSimples),
      p.opcaoSimples === '3' ? el('regApTribSN', p.regimeApuracaoSimples ?? '1') : '',
      el('regEspTrib', p.regimeEspecial || '0'),
    ),
  )

  const toma = t
    ? grupo(
        'toma',
        documento(t.documento),
        el('xNome', t.nome),
        t.endereco ? endereco(t.endereco) : '',
        el('fone', so(t.telefone) || null),
        el('email', t.email),
      )
    : ''

  const obra = s.obra
    ? grupo(
        'obra',
        el('inscImobFisc', s.obra.inscricaoImobiliaria),
        s.obra.cno
          ? el('cObra', s.obra.cno)
          : s.obra.endereco
            ? grupo(
                'end',
                el('CEP', so(s.obra.endereco.cep)),
                el('xLgr', s.obra.endereco.logradouro),
                el('nro', s.obra.endereco.numero || 'S/N'),
                el('xCpl', s.obra.endereco.complemento),
                el('xBairro', s.obra.endereco.bairro),
              )
            : '',
      )
    : ''

  const serv = grupo(
    'serv',
    grupo('locPrest', el('cLocPrestacao', so(s.codigoMunicipioPrestacao))),
    grupo(
      'cServ',
      el('cTribNac', so(s.codigoTributacaoNacional)),
      el('cTribMun', so(s.codigoTributacaoMunicipal) || null),
      el('xDescServ', s.descricao.slice(0, 2000)),
      el('cNBS', so(s.codigoNbs) || null),
    ),
    obra.includes('<cObra>') || obra.includes('<end>') ? obra : '',
    s.informacoesComplementares ? grupo('infoCompl', el('xInfComp', s.informacoesComplementares.slice(0, 2000))) : '',
  )

  const totTrib =
    p.opcaoSimples === '3' && v.percentualTributosSimples != null
      ? el('pTotTribSN', dec2(v.percentualTributosSimples))
      : el('indTotTrib', '0')

  const valores = grupo(
    'valores',
    grupo('vServPrest', el('vServ', dec2(v.valorServico))),
    v.descontoIncondicionado ? grupo('vDescCondIncond', el('vDescIncond', dec2(v.descontoIncondicionado))) : '',
    grupo(
      'trib',
      grupo(
        'tribMun',
        el('tribISSQN', v.tributacaoIssqn),
        el('tpRetISSQN', v.retencaoIssqn),
        v.aliquotaIssqn != null ? el('pAliq', dec2(v.aliquotaIssqn)) : '',
      ),
      grupo('totTrib', totTrib),
    ),
  )

  const inf =
    `<infDPS Id="${id}">` +
    el('tpAmb', d.ambiente === 'producao' ? '1' : '2') +
    el('dhEmi', dataHoraBrasilia(d.emitidaEm)) +
    el('verAplic', VERSAO_APLICATIVO) +
    el('serie', String(Number(so(d.serie)) || 1)) +
    el('nDPS', String(d.numero)) +
    el('dCompet', d.competencia) +
    el('tpEmit', '1') +
    el('cLocEmi', so(p.codigoMunicipio)) +
    prest +
    toma +
    serv +
    valores +
    '</infDPS>'

  return { xml: `<DPS xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}">${inf}</DPS>`, id }
}

export type MotivoCancelamento = '1' | '2' | '9' // erro na emissão, serviço não prestado, outros

// Pedido de registro do evento 101101 (cancelamento).
export function montarCancelamento(a: {
  ambiente: Ambiente
  documentoAutor: string
  chave: string
  motivo: MotivoCancelamento
  justificativa: string
  quando: Date
}): string {
  const doc = so(a.documentoAutor)
  return (
    `<pedRegEvento xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}">` +
    `<infPedReg Id="PRE${a.chave}101101">` +
    el('tpAmb', a.ambiente === 'producao' ? '1' : '2') +
    el('verAplic', VERSAO_APLICATIVO) +
    el('dhEvento', dataHoraBrasilia(a.quando)) +
    (doc.length === 11 ? el('CPFAutor', doc) : el('CNPJAutor', doc)) +
    el('chNFSe', a.chave) +
    '<e101101>' +
    el('xDesc', 'Cancelamento de NFS-e') +
    el('cMotivo', a.motivo) +
    el('xMotivo', a.justificativa.slice(0, 255)) +
    '</e101101>' +
    '</infPedReg></pedRegEvento>'
  )
}
