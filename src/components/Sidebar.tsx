'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  STATUS_PROJETO_LABEL,
  type Projeto,
  type StatusProjeto,
} from '@/types'

const STATUS_DOT: Record<StatusProjeto, string> = {
  planejamento: 'bg-sky-400',
  em_execucao: 'bg-amber-400',
  pausado: 'bg-zinc-400',
  completo: 'bg-emerald-400',
}

type Props = {
  empresaNome: string
  projetos: Projeto[]
}

export default function Sidebar({ empresaNome, projetos }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [filtro, setFiltro] = useState<StatusProjeto | 'todos'>('todos')

  const projetosFiltrados = useMemo(() => {
    if (filtro === 'todos') return projetos
    return projetos.filter((p) => p.status === filtro)
  }, [projetos, filtro])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const linkBase =
    'block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-hover'
  const linkActive = 'bg-sidebar-hover text-white'

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">
          {empresaNome.slice(0, 1).toUpperCase()}
        </div>
        <span className="truncate font-medium">{empresaNome}</span>
      </div>

      <nav className="space-y-1 px-3">
        <Link
          href="/clientes"
          className={`${linkBase} ${pathname.startsWith('/clientes') ? linkActive : ''}`}
        >
          Clientes
        </Link>
        <Link
          href="/equipe"
          className={`${linkBase} ${pathname.startsWith('/equipe') ? linkActive : ''}`}
        >
          Equipe
        </Link>
        <Link
          href="/empresa"
          className={`${linkBase} ${pathname.startsWith('/empresa') ? linkActive : ''}`}
        >
          Empresa
        </Link>
      </nav>

      <div className="mt-5 flex items-center justify-between px-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-sidebar-muted">
          Projetos
        </span>
        <Link
          href="/projetos/novo"
          title="Novo projeto"
          className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
        >
          +
        </Link>
      </div>

      <div className="px-4 pt-2">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as StatusProjeto | 'todos')}
          className="w-full rounded-lg border border-white/10 bg-sidebar-hover px-2 py-1.5 text-xs text-sidebar-foreground outline-none"
        >
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_PROJETO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {projetosFiltrados.length === 0 && (
          <p className="px-3 py-4 text-xs text-sidebar-muted">
            Nenhum projeto por aqui ainda.
          </p>
        )}
        {projetosFiltrados.map((p) => (
          <Link
            key={p.id}
            href={`/projetos/${p.id}`}
            className={`block rounded-lg px-3 py-2 hover:bg-sidebar-hover ${
              pathname === `/projetos/${p.id}` ? linkActive : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[p.status]}`}
              />
              <span className="truncate text-sm">{p.nome}</span>
            </div>
            <div className="ml-3.5 flex items-center justify-between text-xs text-sidebar-muted">
              <span className="truncate">{p.clientes?.nome ?? ''}</span>
              <span className="shrink-0 pl-2">{p.percentual_conclusao}%</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <button
          onClick={sair}
          className="text-xs text-sidebar-muted hover:text-white"
        >
          Sair da conta
        </button>
      </div>
    </aside>
  )
}
