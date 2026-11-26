'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'
import type { Empresa } from '@/types'

export default function EmpresaForm({ empresa }: { empresa: Empresa }) {
  const router = useRouter()
  const supabase = createClient()
  const [nome, setNome] = useState(empresa.nome)
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? '')
  const [descricao, setDescricao] = useState(empresa.descricao ?? '')
  const [modoOperacao, setModoOperacao] = useState(empresa.modo_operacao ?? '')
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    await supabase
      .from('empresas')
      .update({
        nome,
        cnpj: cnpj || null,
        descricao: descricao || null,
        modo_operacao: modoOperacao || null,
      })
      .eq('id', empresa.id)
    setSalvando(false)
    setSalvo(true)
    router.refresh()
    setTimeout(() => setSalvo(false), 2000)
  }

  const label = 'mb-1 block text-sm font-medium text-muted'

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>Nome da empresa</label>
        <VoiceTextInput value={nome} onChange={setNome} />
      </div>
      <div>
        <label className={label}>CNPJ</label>
        <VoiceTextInput value={cnpj} onChange={setCnpj} placeholder="Opcional" />
      </div>
      <div>
        <label className={label}>O que a empresa faz</label>
        <VoiceTextInput value={descricao} onChange={setDescricao} multiline />
      </div>
      <div>
        <label className={label}>Como você conduz as obras</label>
        <VoiceTextInput value={modoOperacao} onChange={setModoOperacao} multiline />
      </div>
      <button
        onClick={salvar}
        disabled={salvando}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Salvar alterações'}
      </button>
    </div>
  )
}
