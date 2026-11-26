'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UsersIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { descreverMotivos, type ClienteChave, type Duplicado } from '@/lib/duplicados'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'

// Lista enxuta dos clientes da empresa (id, nome, telefone, documento) para
// checar duplicados no navegador, sem depender de SQL novo.
export function useClientesExistentes(empresaId: string): ClienteChave[] {
  const [lista, setLista] = useState<ClienteChave[]>([])
  useEffect(() => {
    let ativo = true
    createClient()
      .from('clientes')
      .select('id, nome, telefone, cpf, cnpj')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        if (ativo) setLista((data as ClienteChave[] | null) ?? [])
      })
    return () => {
      ativo = false
    }
  }, [empresaId])
  return lista
}

export function AvisoDuplicado({ duplicados }: { duplicados: Duplicado[] }) {
  if (duplicados.length === 0) return null
  const um = duplicados.length === 1
  return (
    <Alert variant="warning" role="status">
      <UsersIcon />
      <AlertTitle>{um ? 'Este cliente pode já estar cadastrado' : 'Estes clientes podem já estar cadastrados'}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1.5">
          {duplicados.slice(0, 3).map(({ cliente, motivos }) => (
            <li key={cliente.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium text-foreground">{cliente.nome}</span> · {descreverMotivos(motivos)}
              </span>
              <Button
                variant="outline"
                size="xs"
                nativeButton={false}
                render={<Link href={`/clientes/${cliente.id}`} />}
              >
                Abrir cadastro
              </Button>
            </li>
          ))}
        </ul>
        <span>Se for outra pessoa, pode salvar mesmo assim.</span>
      </AlertDescription>
    </Alert>
  )
}
