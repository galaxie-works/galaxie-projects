// Máscaras de CPF e CNPJ. Guardamos o valor já formatado, como antes.

function digitos(valor: string, limite: number) {
  return valor.replace(/\D/g, '').slice(0, limite)
}

export function mascararCpf(valor: string): string {
  const d = digitos(valor, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function mascararCnpj(valor: string): string {
  const d = digitos(valor, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function documentoCompleto(valor: string, tipo: 'PF' | 'PJ'): boolean {
  const total = valor.replace(/\D/g, '').length
  return total === 0 || total === (tipo === 'PF' ? 11 : 14)
}
