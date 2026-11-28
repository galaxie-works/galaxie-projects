'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

// Nome de quem está logado (aparece no menu do usuário).
export function NomeUsuario({ userId, nomeAtual, email }: { userId: string; nomeAtual: string; email: string }) {
  const router = useRouter()
  const [nome, setNome] = useState(nomeAtual)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    const { error } = await createClient()
      .from('perfis')
      .upsert({ user_id: userId, nome: nome.trim() || null, updated_at: new Date().toISOString() })
    setSalvando(false)
    if (error) {
      setErro(`Não foi possível salvar: ${error.message}`)
      return
    }
    setSalvo(true)
    router.refresh()
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <Field data-invalid={!!erro || undefined}>
        <FieldLabel htmlFor="conta-nome">Seu nome</FieldLabel>
        <Input
          id="conta-nome"
          value={nome}
          autoComplete="name"
          placeholder="Como você quer ser chamado"
          onChange={(e) => {
            setNome(e.target.value)
            setSalvo(false)
          }}
        />
        <FieldDescription>Entra com o e-mail {email}.</FieldDescription>
        {erro && <FieldError>{erro}</FieldError>}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={salvando || nome.trim() === nomeAtual.trim()}>
          {salvando ? <Spinner data-icon="inline-start" /> : salvo ? <CheckIcon data-icon="inline-start" /> : null}
          {salvo && nome.trim() === nomeAtual.trim() ? 'Salvo' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
