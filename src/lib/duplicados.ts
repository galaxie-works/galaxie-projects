import type { Cliente } from '@/types'

// Detecção de cliente duplicado por telefone e CPF/CNPJ. Compara só os
// dígitos, para pegar também cadastros antigos digitados em texto livre.

export type ClienteChave = Pick<Cliente, 'id' | 'nome' | 'telefone' | 'cpf' | 'cnpj'>

export type MotivoDuplicado = 'telefone' | 'documento'

export type Duplicado = { cliente: ClienteChave; motivos: MotivoDuplicado[] }

export function soDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '')
}

// Telefone brasileiro sem o DDI 55, para +5511987654321 e (11) 98765-4321
// virarem a mesma chave. Números curtos demais não servem de chave.
export function chaveTelefone(valor: string | null | undefined): string {
  let d = soDigitos(valor)
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d.length >= 8 ? d : ''
}

export function chaveDocumento(valor: string | null | undefined): string {
  const d = soDigitos(valor)
  return d.length === 11 || d.length === 14 ? d : ''
}

type Dados = { telefone?: string | null; cpf?: string | null; cnpj?: string | null }

// Índice para checar muitas linhas de uma vez (importação de CSV).
export function indiceClientes(lista: ClienteChave[]) {
  const porTelefone = new Map<string, ClienteChave>()
  const porDocumento = new Map<string, ClienteChave>()
  for (const c of lista) {
    const t = chaveTelefone(c.telefone)
    if (t && !porTelefone.has(t)) porTelefone.set(t, c)
    for (const doc of [c.cpf, c.cnpj]) {
      const k = chaveDocumento(doc)
      if (k && !porDocumento.has(k)) porDocumento.set(k, c)
    }
  }
  return { porTelefone, porDocumento }
}

export function acharDuplicados(lista: ClienteChave[], dados: Dados, ignorarId?: string): Duplicado[] {
  const telefone = chaveTelefone(dados.telefone)
  const documentos = [chaveDocumento(dados.cpf), chaveDocumento(dados.cnpj)].filter(Boolean)
  if (!telefone && documentos.length === 0) return []

  const achados: Duplicado[] = []
  for (const c of lista) {
    if (c.id === ignorarId) continue
    const motivos: MotivoDuplicado[] = []
    if (telefone && chaveTelefone(c.telefone) === telefone) motivos.push('telefone')
    const docsCliente = [chaveDocumento(c.cpf), chaveDocumento(c.cnpj)]
    if (documentos.some((d) => docsCliente.includes(d))) motivos.push('documento')
    if (motivos.length) achados.push({ cliente: c, motivos })
  }
  return achados
}

export function descreverMotivos(motivos: MotivoDuplicado[]): string {
  return motivos.map((m) => (m === 'telefone' ? 'mesmo telefone' : 'mesmo CPF/CNPJ')).join(' e ')
}
