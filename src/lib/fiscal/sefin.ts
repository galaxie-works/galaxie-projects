import { request } from 'node:https'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { Ambiente } from './dps'

// Cliente da API pública da Sefin Nacional (NFS-e padrão nacional).
// Autenticação por mTLS com o certificado A1 da empresa; não há token nem custo.
// Os XMLs vão e voltam comprimidos em GZip e codificados em base64 dentro do JSON.

const BASE: Record<Ambiente, string> = {
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
}

export const CONSULTA_PUBLICA = 'https://www.nfse.gov.br/consultapublica'

export type MensagemSefin = { codigo?: string; descricao?: string; complemento?: string; mensagem?: string }

export type RespostaSefin = {
  status: number
  corpo: Record<string, unknown> | null
  bruto: string
}

export function compactar(xml: string): string {
  const comCabecalho = xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8"?>${xml}`
  return gzipSync(Buffer.from(comCabecalho, 'utf8')).toString('base64')
}

export function descompactar(b64: unknown): string | null {
  if (typeof b64 !== 'string' || !b64) return null
  try {
    return gunzipSync(Buffer.from(b64, 'base64')).toString('utf8')
  } catch {
    return null
  }
}

function chamar(
  ambiente: Ambiente,
  metodo: 'GET' | 'POST',
  caminho: string,
  cert: { pfx: Buffer; senha: string },
  corpo?: Record<string, unknown>,
): Promise<RespostaSefin> {
  const url = new URL(`${BASE[ambiente]}/${caminho.replace(/^\//, '')}`)
  const dados = corpo ? Buffer.from(JSON.stringify(corpo), 'utf8') : undefined
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: metodo,
        pfx: cert.pfx,
        passphrase: cert.senha,
        timeout: 30_000,
        headers: {
          Accept: 'application/json',
          ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': dados.length } : {}),
        },
      },
      (res) => {
        const partes: Buffer[] = []
        res.on('data', (p: Buffer) => partes.push(p))
        res.on('end', () => {
          const bruto = Buffer.concat(partes).toString('utf8')
          let json: Record<string, unknown> | null = null
          try {
            json = bruto ? (JSON.parse(bruto) as Record<string, unknown>) : null
          } catch {
            json = null
          }
          resolve({ status: res.statusCode ?? 0, corpo: json, bruto })
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('A Sefin Nacional não respondeu em 30 segundos.')))
    req.on('error', reject)
    if (dados) req.write(dados)
    req.end()
  })
}

export function mensagensDeErro(corpo: Record<string, unknown> | null): MensagemSefin[] {
  if (!corpo) return []
  const lista: MensagemSefin[] = []
  for (const chave of ['erros', 'erro', 'Erros', 'Erro']) {
    const v = corpo[chave]
    if (Array.isArray(v)) lista.push(...(v as MensagemSefin[]))
    else if (v && typeof v === 'object') lista.push(v as MensagemSefin)
  }
  return lista
}

export function emitirDps(ambiente: Ambiente, cert: { pfx: Buffer; senha: string }, dpsAssinada: string) {
  return chamar(ambiente, 'POST', 'nfse', cert, { dpsXmlGZipB64: compactar(dpsAssinada) })
}

export function consultarDps(ambiente: Ambiente, cert: { pfx: Buffer; senha: string }, id: string) {
  return chamar(ambiente, 'GET', `dps/${id}`, cert)
}

export function consultarNfse(ambiente: Ambiente, cert: { pfx: Buffer; senha: string }, chave: string) {
  return chamar(ambiente, 'GET', `nfse/${chave}`, cert)
}

export function registrarEvento(
  ambiente: Ambiente,
  cert: { pfx: Buffer; senha: string },
  chave: string,
  pedidoAssinado: string,
) {
  return chamar(ambiente, 'POST', `nfse/${chave}/eventos`, cert, {
    pedidoRegistroEventoXmlGZipB64: compactar(pedidoAssinado),
  })
}

// Lê o número da NFS-e (nNFSe) do XML autorizado.
export function numeroDaNfse(xml: string | null): string | null {
  return xml?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] ?? null
}
