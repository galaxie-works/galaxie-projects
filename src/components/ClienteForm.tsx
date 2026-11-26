'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'
import type { TipoCliente } from '@/types'

export default function ClienteForm({ empresaId }: { empresaId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [tipo, setTipo] = useState<TipoCliente>('PF')
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome do cliente.')
      return
    }
    setSalvando(true)
    setErro(null)

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        empresa_id: empresaId,
        tipo,
        nome,
        cpf: tipo === 'PF' ? cpf || null : null,
        cnpj: tipo === 'PJ' ? cnpj || null : null,
        razao_social: tipo === 'PJ' ? razaoSocial || null : null,
        email: email || null,
        telefone: telefone || null,
        endereco: endereco || null,
      })
      .select('id')
      .single()

    setSalvando(false)
    if (error || !data) {
      setErro(error?.message ?? 'Erro ao salvar cliente.')
      return
    }
    router.push(`/clientes/${data.id}`)
    router.refresh()
  }

  const label = 'mb-1 block text-sm font-medium text-muted'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={label}>Tipo de cliente</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTipo('PF')}
            className={`rounded-xl border px-4 py-2 text-sm ${
              tipo === 'PF'
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-card'
            }`}
          >
            Pessoa física
          </button>
          <button
            type="button"
            onClick={() => setTipo('PJ')}
            className={`rounded-xl border px-4 py-2 text-sm ${
              tipo === 'PJ'
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-card'
            }`}
          >
            Pessoa jurídica
          </button>
        </div>
      </div>

      <div>
        <label className={label}>
          {tipo === 'PF' ? 'Nome completo' : 'Nome fantasia'}
        </label>
        <VoiceTextInput value={nome} onChange={setNome} placeholder="Nome" />
      </div>

      {tipo === 'PF' ? (
        <div>
          <label className={label}>CPF</label>
          <VoiceTextInput value={cpf} onChange={setCpf} placeholder="000.000.000-00" />
        </div>
      ) : (
        <>
          <div>
            <label className={label}>Razão social</label>
            <VoiceTextInput
              value={razaoSocial}
              onChange={setRazaoSocial}
              placeholder="Razão social"
            />
          </div>
          <div>
            <label className={label}>CNPJ</label>
            <VoiceTextInput
              value={cnpj}
              onChange={setCnpj}
              placeholder="00.000.000/0000-00"
            />
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>E-mail</label>
          <VoiceTextInput value={email} onChange={setEmail} placeholder="E-mail" />
        </div>
        <div>
          <label className={label}>Telefone</label>
          <VoiceTextInput
            value={telefone}
            onChange={setTelefone}
            placeholder="Telefone"
          />
        </div>
      </div>

      <div>
        <label className={label}>Endereço</label>
        <VoiceTextInput
          value={endereco}
          onChange={setEndereco}
          placeholder="Endereço completo"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar cliente'}
      </button>
    </form>
  )
}
