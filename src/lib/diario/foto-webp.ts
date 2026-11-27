'use client'

// Compacta a foto no próprio aparelho e converte para WebP antes de guardar.
// Assim a fila offline ocupa pouco e o envio gasta pouco do plano de dados.
// O canvas gera WebP direto no Chrome/Android; onde ele não gera (Safari
// devolve PNG), um codificador WebP em WebAssembly faz a conversão.

const LADO_MAXIMO = 1600
const QUALIDADE = 0.72

export type FotoCompactada = { blob: Blob; largura: number; altura: number }

async function carregarImagem(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // Respeita a orientação da câmera (EXIF).
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    } catch {
      // HEIC e afins: tenta pelo <img>, que usa os decodificadores do sistema.
    }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade))
}

export async function compactarParaWebp(arquivo: Blob): Promise<FotoCompactada> {
  const imagem = await carregarImagem(arquivo)
  const w0 = 'naturalWidth' in imagem ? imagem.naturalWidth : imagem.width
  const h0 = 'naturalHeight' in imagem ? imagem.naturalHeight : imagem.height
  const escala = Math.min(1, LADO_MAXIMO / Math.max(w0, h0))
  const largura = Math.max(1, Math.round(w0 * escala))
  const altura = Math.max(1, Math.round(h0 * escala))

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este aparelho não conseguiu processar a foto.')
  ctx.drawImage(imagem, 0, 0, largura, altura)
  if ('close' in imagem) imagem.close()

  const nativo = await paraBlob(canvas, 'image/webp', QUALIDADE)
  if (nativo && nativo.type === 'image/webp') return { blob: nativo, largura, altura }

  // Sem WebP no canvas (Safari): codifica em WebAssembly.
  const { default: encode } = await import('@jsquash/webp/encode')
  const dados = ctx.getImageData(0, 0, largura, altura)
  const buffer = await encode(dados, { quality: Math.round(QUALIDADE * 100) })
  return { blob: new Blob([buffer], { type: 'image/webp' }), largura, altura }
}

function canvasGeraWebp(): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

/**
 * Onde o canvas não gera WebP, baixa o codificador agora (com internet), para
 * ele ficar guardado pelo service worker e funcionar depois sem conexão.
 */
export async function prepararCodificadorWebp(): Promise<void> {
  if (canvasGeraWebp()) return
  const { init } = await import('@jsquash/webp/encode')
  await init()
}
