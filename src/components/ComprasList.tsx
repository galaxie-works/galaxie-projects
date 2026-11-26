'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'
import type { Compra, MembroEquipe } from '@/types'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ComprasList({
  projetoId,
  comprasIniciais,
  equipe,
}: {
  projetoId: string
  comprasIniciais: Compra[]
  equipe: MembroEquipe[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [compras, setCompras] = useState(comprasIniciais)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [data, setData] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  async function adicionar() {
    if (!descricao.trim() || !valor) return
    const { data: nova, error } = await supabase
      .from('compras')
      .insert({
        projeto_id: projetoId,
        descricao,
        valor: Number(valor),
        responsavel_id: responsavelId || null,
        data: data || null,
      })
      .select('*, equipe(nome)')
      .single()
    if (!error && nova) {
      setCompras((c) => [nova as Compra, ...c])
      setDescricao('')
      setValor('')
      setResponsavelId('')
      setData('')
      setMostrarForm(false)
      router.refresh()
    }
  }

  async function remover(id: string) {
    setCompras((c) => c.filter((x) => x.id !== id))
    await supabase.from('compras').delete().eq('id', id)
    router.refresh()
  }

  const total = compras.reduce((acc, c) => acc + Number(c.valor), 0)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">
          Compras e materiais{' '}
          <span className="text-sm font-normal text-muted">
            ({formatBRL(total)})
          </span>
        </h2>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="text-sm text-accent"
        >
          + Adicionar
        </button>
      </div>

      {mostrarForm && (
        <div className="mb-4 space-y-2 rounded-xl border border-border p-3">
          <VoiceTextInput
            value={descricao}
            onChange={setDescricao}
            placeholder="O que foi comprado?"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Valor (R$)"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Responsável</option>
              {equipe.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={adicionar}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Salvar compra
          </button>
        </div>
      )}

      {compras.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma compra registrada.</p>
      ) : (
        <ul className="space-y-2">
          {compras.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
            >
              <span className="truncate text-sm">{c.descricao}</span>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                {c.equipe?.nome && <span>{c.equipe.nome}</span>}
                {c.data && (
                  <span>{new Date(c.data).toLocaleDateString('pt-BR')}</span>
                )}
                <span className="font-medium text-foreground">
                  {formatBRL(Number(c.valor))}
                </span>
                <button
                  onClick={() => remover(c.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Remover"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
