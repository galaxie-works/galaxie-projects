'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  BriefcaseBusinessIcon,
  FileUpIcon,
  FolderKanbanIcon,
  PlusIcon,
  SearchIcon,
  UserPlusIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatarTelefone } from '@/components/clientes/telefone'
import { soDigitos } from '@/lib/duplicados'
import { STATUS_PROJETO_LABEL, type StatusProjeto } from '@/types'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Command } from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Spinner } from '@/components/ui/spinner'

type ClienteBusca = {
  id: string
  nome: string
  telefone: string | null
  cpf: string | null
  cnpj: string | null
  email: string | null
}

type ObraBusca = {
  id: string
  nome: string
  status: StatusProjeto
  clientes: { nome: string } | null
}

type Dados = { clientes: ClienteBusca[]; obras: ObraBusca[] }

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Filtro por trechos: todas as palavras digitadas precisam aparecer no nome,
// telefone, documento ou e-mail. Números comparam só os dígitos, então
// "11 98765" acha "+55 11 98765-4321".
function filtrar(_valor: string, busca: string, palavras?: string[]): number {
  const alvo = normalizar((palavras ?? []).join(' '))
  const alvoDigitos = soDigitos(alvo)
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return 1
  const soNumeros = /^[\d\s().+\/-]+$/.test(busca.trim())
  if (soNumeros) {
    const d = soDigitos(busca)
    return d && alvoDigitos.includes(d) ? 1 : 0
  }
  return termos.every((t) => alvo.includes(t)) ? 1 : 0
}

// Busca global (Ctrl+K / ⌘K): clientes por nome, telefone, CPF/CNPJ ou e-mail,
// e obras por nome ou cliente. Carrega na primeira abertura e a cada nova
// abertura, para pegar cadastros recentes.
export function BuscaGlobal({ empresaId }: { empresaId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(false)
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false
  )

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setAberto((v) => !v)
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    const supabase = createClient()
    const [clientes, obras] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nome, telefone, cpf, cnpj, email')
        .eq('empresa_id', empresaId)
        .order('nome'),
      supabase
        .from('projetos')
        .select('id, nome, status, clientes(nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false }),
    ])
    setDados({
      clientes: (clientes.data as ClienteBusca[] | null) ?? [],
      obras: (obras.data as unknown as ObraBusca[] | null) ?? [],
    })
    setCarregando(false)
  }, [empresaId])

  useEffect(() => {
    // Abrir a busca dispara a leitura dos dados (sistema externo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aberto) void carregar()
  }, [aberto, carregar])

  function ir(href: string) {
    setAberto(false)
    router.push(href)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-muted-foreground max-sm:hidden"
        onClick={() => setAberto(true)}
        aria-label="Buscar clientes e obras"
      >
        <SearchIcon data-icon="inline-start" />
        Buscar
        <KbdGroup className="ml-2">
          <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="sm:hidden"
        onClick={() => setAberto(true)}
        aria-label="Buscar clientes e obras"
      >
        <SearchIcon />
      </Button>

      <CommandDialog
        open={aberto}
        onOpenChange={setAberto}
        title="Buscar"
        description="Busque clientes por nome, telefone ou CPF/CNPJ, e obras por nome"
      >
        <Command filter={filtrar}>
          <CommandInput placeholder="Nome, telefone, CPF/CNPJ ou obra…" />
          <CommandList>
            <CommandEmpty>
              {carregando && !dados ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Spinner /> Carregando…
                </span>
              ) : (
                'Nada encontrado.'
              )}
            </CommandEmpty>

            {dados && dados.clientes.length > 0 && (
              <CommandGroup heading="Clientes">
                {dados.clientes.map((c) => {
                  const telefone = formatarTelefone(c.telefone)
                  const documento = c.cpf || c.cnpj
                  return (
                    <CommandItem
                      key={c.id}
                      value={`cliente-${c.id}`}
                      keywords={[
                        c.nome,
                        telefone,
                        soDigitos(c.telefone),
                        soDigitos(c.telefone).replace(/^55/, ''),
                        documento ?? '',
                        soDigitos(documento),
                        c.email ?? '',
                      ].filter(Boolean)}
                      onSelect={() => ir(`/clientes/${c.id}`)}
                    >
                      <BriefcaseBusinessIcon />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{c.nome}</span>
                        {(telefone || documento) && (
                          <span className="truncate text-xs text-muted-foreground tabular-nums">
                            {[telefone, documento].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {dados && dados.obras.length > 0 && (
              <CommandGroup heading="Obras">
                {dados.obras.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`obra-${o.id}`}
                    keywords={[o.nome, o.clientes?.nome ?? ''].filter(Boolean)}
                    onSelect={() => ir(`/projetos/${o.id}`)}
                  >
                    <FolderKanbanIcon />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{o.nome}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[o.clientes?.nome, STATUS_PROJETO_LABEL[o.status]].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
            <CommandGroup heading="Ações">
              <CommandItem value="acao-novo-cliente" keywords={['novo cliente', 'cadastrar']} onSelect={() => ir('/clientes/novo')}>
                <UserPlusIcon />
                Novo cliente
              </CommandItem>
              <CommandItem value="acao-novo-projeto" keywords={['novo projeto', 'nova obra']} onSelect={() => ir('/projetos/novo')}>
                <PlusIcon />
                Novo projeto
              </CommandItem>
              <CommandItem value="acao-importar" keywords={['importar clientes', 'csv', 'planilha']} onSelect={() => ir('/clientes/importar')}>
                <FileUpIcon />
                Importar clientes de planilha
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
