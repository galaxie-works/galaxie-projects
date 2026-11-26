'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'
import type { MembroEquipe } from '@/types'

export default function EquipeManager({
  empresaId,
  equipeInicial,
}: {
  empresaId: string
  equipeInicial: MembroEquipe[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [equipe, setEquipe] = useState(equipeInicial)
  const [nome, setNome] = useState('')
  const [funcao, setFuncao] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    if (!nome.trim()) {
      setErro('Informe o nome da pessoa.')
      return
    }
    setErro(null)
    const { data, error } = await supabase
      .from('equipe')
      .insert({ empresa_id: empresaId, nome, funcao: funcao || null, telefone: telefone || null })
      .select('*')
      .single()
    if (error || !data) {
      setErro(error?.message ?? 'Erro ao adicionar.')
      return
    }
    setEquipe((e) => [...e, data as MembroEquipe])
    setNome('')
    setFuncao('')
    setTelefone('')
    router.refresh()
  }

  async function remover(id: string) {
    setEquipe((e) => e.filter((m) => m.id !== id))
    await supabase.from('equipe').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-medium">Adicionar pessoa</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <VoiceTextInput value={nome} onChange={setNome} placeholder="Nome" />
          <VoiceTextInput
            value={funcao}
            onChange={setFuncao}
            placeholder="Função / responsabilidade"
          />
          <VoiceTextInput
            value={telefone}
            onChange={setTelefone}
            placeholder="Telefone (opcional)"
          />
        </div>
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        <button
          onClick={adicionar}
          className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Adicionar à equipe
        </button>
      </div>

      {equipe.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          Nenhuma pessoa cadastrada — você está trabalhando sozinho.
        </div>
      ) : (
        <ul className="space-y-2">
          {equipe.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium">{m.nome}</p>
                <p className="text-sm text-muted">
                  {m.funcao}
                  {m.telefone ? ` · ${m.telefone}` : ''}
                </p>
              </div>
              <button
                onClick={() => remover(m.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
