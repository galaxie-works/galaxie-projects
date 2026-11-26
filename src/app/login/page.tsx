'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })
    setCarregando(false)
    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message
      )
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground text-xl font-semibold">
            G
          </div>
          <h1 className="text-xl font-semibold">Entrar no Galaxie Obras</h1>
          <p className="mt-1 text-sm text-muted">
            Gestão de obras, clientes e equipe
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
          <input
            type="password"
            required
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-[15px] font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="font-medium text-accent">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
