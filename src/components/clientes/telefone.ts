import { parsePhoneNumberFromString } from 'libphonenumber-js'

// Telefones novos são salvos em E.164 (+5511987654321) pelo @reui/phone-input.
// Registros antigos podem ter texto livre: tentamos converter para E.164
// (assumindo Brasil) e, se não der, mostramos como está.

export function paraE164(valor: string | null | undefined): string {
  if (!valor) return ''
  if (valor.startsWith('+')) return valor
  const d = valor.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `+55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `+${d}`
  return ''
}

export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return ''
  const e164 = paraE164(valor)
  if (!e164) return valor
  const numero = parsePhoneNumberFromString(e164)
  if (!numero) return valor
  return numero.country === 'BR' ? numero.formatNational() : numero.formatInternational()
}
