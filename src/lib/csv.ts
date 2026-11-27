// Leitura de CSV no navegador. Aceita vírgula, ponto e vírgula (padrão do
// Excel em português) e tabulação; aspas com "" escapado e quebras de linha
// dentro de aspas. Arquivos do Excel antigo vêm em Windows-1252: se o UTF-8
// falhar, decodifica nesse padrão para não estragar os acentos.

export function decodificarArquivo(bytes: ArrayBuffer): string {
  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes)
  }
  return texto.replace(/^﻿/, '')
}

function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? ''
  const contagem = (c: string) => primeira.split(c).length - 1
  const opcoes = [';', ',', '\t']
  return opcoes.reduce((melhor, c) => (contagem(c) > contagem(melhor) ? c : melhor), ';')
}

export function lerCsv(texto: string): string[][] {
  const sep = detectarSeparador(texto)
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else aspas = false
      } else campo += ch
      continue
    }
    if (ch === '"' && campo === '') aspas = true
    else if (ch === sep) {
      linha.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else campo += ch
  }
  if (campo !== '' || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas
    .map((l) => l.map((c) => c.trim()))
    .filter((l) => l.some((c) => c !== ''))
}

export function gerarCsv(linhas: string[][]): string {
  const escapar = (c: string) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  return '﻿' + linhas.map((l) => l.map(escapar).join(';')).join('\r\n')
}
