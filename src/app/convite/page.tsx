'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Marca } from '@/components/onboarding/marca'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type Estado = 'carregando' | 'pronto' | 'invalido'

// Quem foi convidado chega aqui pelo link do e-mail: cria a senha, diz o
// nome e entra direto na empresa que convidou.
export default function ConvitePage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('carregando')
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function iniciar() {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const access = params.get('access_token')
      const refresh = params.get('refresh_token')
      if (access && refresh) {
        const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh })
        // Tira os tokens do endereço.
        window.history.replaceState(null, '', '/convite')
        if (error) {
          setEstado('invalido')
          return
        }
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setEstado('invalido')
        return
      }
      setEmail(user.email ?? '')
      setEstado('pronto')
    }
    iniciar()
  }, [])

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setErro(null)
    setSalvando(true)
    const supabase = createClient()
    const { data: u, error } = await supabase.auth.updateUser({ password: senha })
    if (error || !u.user) {
      setSalvando(false)
      setErro(error?.message ?? 'Não foi possível salvar a senha.')
      return
    }
    if (nome.trim()) {
      await supabase
        .from('perfis')
        .upsert({ user_id: u.user.id, nome: nome.trim(), updated_at: new Date().toISOString() })
    }
    await supabase.rpc('aceitar_convites')
    router.push('/inicio')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <Marca />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="tracking-tight">
            {estado === 'invalido' ? 'Link vencido ou já usado' : 'Bem-vindo à equipe'}
          </CardTitle>
          <CardDescription>
            {estado === 'invalido'
              ? 'Peça um novo convite ou entre, se já criou a senha.'
              : 'Crie sua senha para entrar.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estado === 'carregando' ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : estado === 'invalido' ? (
            <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
              Ir para o login
            </Button>
          ) : (
            <form onSubmit={entrar}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="convite-email">E-mail</FieldLabel>
                  <Input id="convite-email" value={email} disabled readOnly />
                </Field>
                <Field>
                  <FieldLabel htmlFor="convite-nome">Seu nome</FieldLabel>
                  <Input
                    id="convite-nome"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como a equipe te chama"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="convite-senha">Senha</FieldLabel>
                  <Input
                    id="convite-senha"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <FieldDescription>Mínimo de 8 caracteres.</FieldDescription>
                </Field>
                {erro && (
                  <Alert variant="destructive">
                    <AlertDescription>{erro}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <Button type="submit" disabled={salvando}>
                    {salvando && <Spinner data-icon="inline-start" />}
                    Entrar
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
