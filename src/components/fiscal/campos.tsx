'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Opcao = { value: string; label: string }

export function OpcaoSelect({
  id,
  valor,
  opcoes,
  onChange,
}: {
  id?: string
  valor: string
  opcoes: Opcao[]
  onChange: (valor: string) => void
}) {
  return (
    <Select items={opcoes} value={valor} onValueChange={(v) => v && onChange(String(v))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type EnderecoCep = {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  codigoMunicipio: string
}

// Busca o endereço e o código IBGE do município pelo CEP (ViaCEP, gratuito).
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
    const j = await r.json()
    if (j.erro) return null
    return {
      cep: d,
      logradouro: j.logradouro || '',
      bairro: j.bairro || '',
      cidade: j.localidade || '',
      uf: j.uf || '',
      codigoMunicipio: j.ibge || '',
    }
  } catch {
    return null
  }
}

export function mascararCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function mascararDocumento(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
