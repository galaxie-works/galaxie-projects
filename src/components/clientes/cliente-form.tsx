'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2Icon, CircleAlertIcon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { PhoneInput } from '@/components/reui/phone-input'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { TipoCliente } from '@/types'
import { useFormularioAssistente } from '@/components/assistente/formulario-assistente'
import { CampoComVoz } from './campo-com-voz'
import { documentoCompleto, mascararCnpj, mascararCpf } from './documento'
import { AvisoDuplicado, useClientesExistentes } from './aviso-duplicado'
import { acharDuplicados } from '@/lib/duplicados'

export function ClienteForm({ empresaId }: { empresaId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [tipo, setTipo] = useState<TipoCliente>('PF')
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const existentes = useClientesExistentes(empresaId)
  const duplicados = useMemo(
    () =>
      acharDuplicados(existentes, {
        telefone,
        cpf: tipo === 'PF' ? cpf : null,
        cnpj: tipo === 'PJ' ? cnpj : null,
      }),
    [existentes, telefone, cpf, cnpj, tipo]
  )

  useFormularioAssistente({
    id: 'cliente-novo',
    titulo: 'Novo cliente',
    descricao: 'Cadastro de cliente pessoa física ou jurídica',
    campos: [
      { nome: 'tipo', descricao: 'PF (pessoa física) ou PJ (empresa)', esquema: { type: 'string', enum: ['PF', 'PJ'] } },
      { nome: 'nome', descricao: 'Nome completo (PF) ou nome fantasia (PJ)', esquema: { type: 'string' } },
      { nome: 'cpf', descricao: 'CPF, só dígitos ou 000.000.000-00', esquema: { type: 'string' } },
      { nome: 'cnpj', descricao: 'CNPJ, só dígitos ou 00.000.000/0000-00', esquema: { type: 'string' } },
      { nome: 'razao_social', descricao: 'Razão social (só PJ)', esquema: { type: 'string' } },
      { nome: 'telefone', descricao: 'Telefone em E.164, ex. +5511987654321', esquema: { type: 'string' } },
      { nome: 'email', descricao: 'E-mail', esquema: { type: 'string' } },
      { nome: 'endereco', descricao: 'Endereço da obra', esquema: { type: 'string' } },
    ],
    valores: () => ({ tipo, nome, cpf, cnpj, razao_social: razaoSocial, telefone, email, endereco }),
    preencher: (v) => {
      const texto = (x: unknown) => (typeof x === 'string' ? x : undefined)
      if (v.tipo === 'PF' || v.tipo === 'PJ') setTipo(v.tipo)
      if (texto(v.nome) !== undefined) setNome(texto(v.nome)!)
      if (texto(v.cpf) !== undefined) setCpf(mascararCpf(texto(v.cpf)!))
      if (texto(v.cnpj) !== undefined) setCnpj(mascararCnpj(texto(v.cnpj)!))
      if (texto(v.razao_social) !== undefined) setRazaoSocial(texto(v.razao_social)!)
      if (texto(v.telefone) !== undefined) setTelefone(texto(v.telefone)!)
      if (texto(v.email) !== undefined) setEmail(texto(v.email)!)
      if (texto(v.endereco) !== undefined) setEndereco(texto(v.endereco)!)
    },
    salvar: () => formRef.current?.requestSubmit(),
  })

  const documento = tipo === 'PF' ? cpf : cnpj
  const erroNome = tentouSalvar && !nome.trim() ? 'Informe o nome do cliente.' : null
  const erroDocumento =
    tentouSalvar && !documentoCompleto(documento, tipo)
      ? `${tipo === 'PF' ? 'CPF' : 'CNPJ'} incompleto.`
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTentouSalvar(true)
    if (!nome.trim() || !documentoCompleto(documento, tipo)) return
    setSalvando(true)
    setErro(null)

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        empresa_id: empresaId,
        tipo,
        nome,
        cpf: tipo === 'PF' ? cpf || null : null,
        cnpj: tipo === 'PJ' ? cnpj || null : null,
        razao_social: tipo === 'PJ' ? razaoSocial || null : null,
        email: email || null,
        telefone: telefone || null,
        endereco: endereco || null,
      })
      .select('id')
      .single()

    setSalvando(false)
    if (error || !data) {
      setErro(error?.message ?? 'Erro ao salvar cliente.')
      return
    }
    toast.success('Cliente cadastrado')
    router.push(`/clientes/${data.id}`)
    router.refresh()
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <Frame spacing="default">
        <FramePanel>
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo de cliente</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[tipo]}
                onValueChange={(valor) => {
                  const proximo = valor[0] as TipoCliente | undefined
                  if (proximo) setTipo(proximo)
                }}
                aria-label="Tipo de cliente"
              >
                <ToggleGroupItem value="PF">
                  <UserIcon />
                  Pessoa física
                </ToggleGroupItem>
                <ToggleGroupItem value="PJ">
                  <Building2Icon />
                  Pessoa jurídica
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!erroNome || undefined}>
                <FieldLabel htmlFor="cliente-nome">
                  {tipo === 'PF' ? 'Nome completo' : 'Nome fantasia'}
                </FieldLabel>
                <CampoComVoz
                  id="cliente-nome"
                  value={nome}
                  onChange={setNome}
                  placeholder={tipo === 'PF' ? 'Mariana Albuquerque' : 'Construtora Horizonte'}
                  invalido={!!erroNome}
                  autoFocus
                />
                <FieldError>{erroNome}</FieldError>
              </Field>

              <Field data-invalid={!!erroDocumento || undefined}>
                <FieldLabel htmlFor="cliente-documento">{tipo === 'PF' ? 'CPF' : 'CNPJ'}</FieldLabel>
                <Input
                  id="cliente-documento"
                  inputMode="numeric"
                  value={documento}
                  onChange={(e) =>
                    tipo === 'PF'
                      ? setCpf(mascararCpf(e.target.value))
                      : setCnpj(mascararCnpj(e.target.value))
                  }
                  placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  aria-invalid={!!erroDocumento || undefined}
                  className="tabular-nums"
                />
                {erroDocumento ? (
                  <FieldError>{erroDocumento}</FieldError>
                ) : (
                  <FieldDescription>Opcional.</FieldDescription>
                )}
              </Field>
            </div>

            {tipo === 'PJ' && (
              <Field>
                <FieldLabel htmlFor="cliente-razao">Razão social</FieldLabel>
                <Input
                  id="cliente-razao"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Horizonte Engenharia e Construções Ltda."
                />
              </Field>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cliente-telefone">Telefone</FieldLabel>
                <PhoneInput
                  id="cliente-telefone"
                  defaultCountry="BR"
                  value={telefone}
                  onChange={(valor) => setTelefone(valor ?? '')}
                  placeholder="(11) 98765-4321"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cliente-email">E-mail</FieldLabel>
                <Input
                  id="cliente-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@exemplo.com.br"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="cliente-endereco">Endereço da obra</FieldLabel>
              <CampoComVoz
                id="cliente-endereco"
                value={endereco}
                onChange={setEndereco}
                placeholder="Rua das Acácias, 214 — Vila Mariana, São Paulo"
              />
            </Field>

            <AvisoDuplicado duplicados={duplicados} />

            {erro && (
              <Alert variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertTitle>Não foi possível salvar</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </FramePanel>
        <FrameFooter className="flex-row justify-end gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/clientes" />}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando && <Spinner data-icon="inline-start" />}
            {salvando ? 'Salvando…' : duplicados.length ? 'Salvar mesmo assim' : 'Salvar cliente'}
          </Button>
        </FrameFooter>
      </Frame>
    </form>
  )
}
