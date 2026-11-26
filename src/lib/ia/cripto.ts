import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Cifra a chave de API do provedor antes de gravar no banco (AES-256-GCM).
// Só roda no servidor: a chave mestra vem de IA_CHAVE_MESTRA (Vercel) e
// nunca vai para o navegador. Formato gravado: v1.<iv>.<tag>.<dados> (base64url).

function chaveMestra(): Buffer {
  const segredo = process.env.IA_CHAVE_MESTRA
  if (!segredo || segredo.length < 32) {
    throw new Error(
      'IA_CHAVE_MESTRA não configurada no servidor (mínimo 32 caracteres).',
    )
  }
  return createHash('sha256').update(segredo).digest()
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const cifra = createCipheriv('aes-256-gcm', chaveMestra(), iv)
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()])
  const tag = cifra.getAuthTag()
  return ['v1', iv, tag, dados].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

export function decifrar(guardado: string): string {
  const [versao, iv, tag, dados] = guardado.split('.')
  if (versao !== 'v1' || !iv || !tag || !dados) throw new Error('Chave guardada em formato inválido.')
  const decifra = createDecipheriv('aes-256-gcm', chaveMestra(), Buffer.from(iv, 'base64url'))
  decifra.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decifra.update(Buffer.from(dados, 'base64url')), decifra.final()]).toString('utf8')
}

export function chaveMestraConfigurada(): boolean {
  const segredo = process.env.IA_CHAVE_MESTRA
  return !!segredo && segredo.length >= 32
}
