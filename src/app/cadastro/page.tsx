'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Marca } from '@/components/onboarding/marca'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export default function CadastroPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setCarregando(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    })
    setCarregando(false)
    if (error) {
      setErro(error.message)
      return
    }
    if (data.session) {
      router.push('/onboarding')
      router.refresh()
      return
    }
    setAviso('Confirme seu e-mail para entrar.')
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <Marca />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="tracking-tight">Criar conta</CardTitle>
          <CardDescription>Leva menos de um minuto.</CardDescription>
        </CardHeader>
        <CardContent>
          {aviso ? (
            <Alert variant="success" role="status">
              <AlertTitle>Conta criada</AlertTitle>
              <AlertDescription>{aviso}</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com.br"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="senha">Senha</FieldLabel>
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <FieldDescription>Mínimo de 6 caracteres.</FieldDescription>
                </Field>
                {erro && (
                  <Alert variant="destructive">
                    <AlertDescription>{erro}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <Button type="submit" disabled={carregando}>
                    {carregando && <Spinner data-icon="inline-start" />}
                    {carregando ? 'Criando…' : 'Criar conta'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  )
}
