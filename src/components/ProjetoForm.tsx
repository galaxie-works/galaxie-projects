'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VoiceTextInput from '@/components/VoiceTextInput'
import { STATUS_PROJETO_LABEL, type Cliente, type StatusProjeto } from '@/types'

type Props = {
  empresaId: string
  clientes: Cliente[]
  clienteIdInicial?: string
}

export default function ProjetoForm({
  empresaId,
  clientes,
  clienteIdInicial,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [nome, setNome] = useState('')
  const [clienteId, setClienteId] = useState(
    clienteIdInicial ?? clientes[0]?.id ?? ''
  )
  const [status, setStatus] = useState<StatusProjeto>('planejamento')
  const [dataInicio, setDataInicio] = useState('')
  const [dataPrazo, setDataPrazo] = useState('')
  const [orcamento, setOrcamento] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome para o projeto.')
      return
    }
    if (!clienteId) {
      setErro('Selecione o cliente deste projeto.')
      return
    }
    setSalvando(true)
    setErro(null)

    const { data, error } = await supabase
      .from('projetos')
      .insert({
        empresa_id: empresaId,
        cliente_id: clienteId,
        nome,
        status,
        data_inicio: dataInicio || null,
        data_prazo: dataPrazo || null,
        orcamento_total: orcamento ? Number(orcamento) : 0,
      })
      .select('id')
      .single()

    setSalvando(false)
    if (error || !data) {
      setErro(error?.message ?? 'Erro ao salvar projeto.')
      return
    }
    router.push(`/projetos/${data.id}`)
    router.refresh()
  }

  const label = 'mb-1 block text-sm font-medium text-muted'
  const inputClass =
    'w-full rounded-xl border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent'

  if (clientes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
        Você precisa cadastrar um cliente antes de criar um projeto.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={label}>Nome do projeto</label>
        <VoiceTextInput
          value={nome}
          onChange={setNome}
          placeholder="Ex: Reforma cozinha, Construção residencial…"
        />
      </div>

      <div>
        <label className={label}>Cliente</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className={inputClass}
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusProjeto)}
            className={inputClass}
          >
            {Object.entries(STATUS_PROJETO_LABEL).map(([value, l]) => (
              <option key={value} value={value}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Orçamento total (R$)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            placeholder="0,00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Data de início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={label}>Prazo final</label>
          <input
            type="date"
            value={dataPrazo}
            onChange={(e) => setDataPrazo(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Criar projeto'}
      </button>
    </form>
  )
}
