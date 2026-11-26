'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'
import {
  STATUS_ETAPA_LABEL,
  type Etapa,
  type MembroEquipe,
  type StatusEtapa,
} from '@/types'

const PROXIMO_STATUS: Record<StatusEtapa, StatusEtapa> = {
  pendente: 'em_andamento',
  em_andamento: 'concluida',
  concluida: 'pendente',
}

const STATUS_DOT: Record<StatusEtapa, string> = {
  pendente: 'bg-zinc-300',
  em_andamento: 'bg-amber-400',
  concluida: 'bg-emerald-400',
}

export default function EtapasList({
  projetoId,
  etapasIniciais,
  equipe,
}: {
  projetoId: string
  etapasIniciais: Etapa[]
  equipe: MembroEquipe[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [etapas, setEtapas] = useState(etapasIniciais)
  const [nome, setNome] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [dataPrazo, setDataPrazo] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  async function adicionar() {
    if (!nome.trim()) return
    const { data, error } = await supabase
      .from('etapas')
      .insert({
        projeto_id: projetoId,
        nome,
        responsavel_id: responsavelId || null,
        data_prazo: dataPrazo || null,
        ordem: etapas.length,
      })
      .select('*, equipe(nome)')
      .single()
    if (!error && data) {
      setEtapas((e) => [...e, data as Etapa])
      setNome('')
      setResponsavelId('')
      setDataPrazo('')
      setMostrarForm(false)
      router.refresh()
    }
  }

  async function alternarStatus(etapa: Etapa) {
    const novoStatus = PROXIMO_STATUS[etapa.status]
    setEtapas((lista) =>
      lista.map((e) => (e.id === etapa.id ? { ...e, status: novoStatus } : e))
    )
    await supabase
      .from('etapas')
      .update({ status: novoStatus })
      .eq('id', etapa.id)
    router.refresh()
  }

  async function remover(id: string) {
    setEtapas((lista) => lista.filter((e) => e.id !== id))
    await supabase.from('etapas').delete().eq('id', id)
    router.refresh()
  }

  const concluidas = etapas.filter((e) => e.status === 'concluida').length

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">
          Etapas{' '}
          <span className="text-sm font-normal text-muted">
            ({concluidas}/{etapas.length} concluídas)
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
            value={nome}
            onChange={setNome}
            placeholder="Nome da etapa (ex: Fundação, Instalação elétrica…)"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Responsável (opcional)</option>
              {equipe.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dataPrazo}
              onChange={(e) => setDataPrazo(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={adicionar}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Salvar etapa
          </button>
        </div>
      )}

      {etapas.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma etapa cadastrada.</p>
      ) : (
        <ul className="space-y-2">
          {etapas.map((etapa) => (
            <li
              key={etapa.id}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
            >
              <button
                onClick={() => alternarStatus(etapa)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title="Clique para mudar o status"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[etapa.status]}`}
                />
                <span className="truncate text-sm">{etapa.nome}</span>
              </button>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                {etapa.equipe?.nome && <span>{etapa.equipe.nome}</span>}
                {etapa.data_prazo && (
                  <span>
                    {new Date(etapa.data_prazo).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <span>{STATUS_ETAPA_LABEL[etapa.status]}</span>
                <button
                  onClick={() => remover(etapa.id)}
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
