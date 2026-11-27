'use client'

import { useState, useTransition } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useFormularioAssistente } from '@/components/assistente/formulario-assistente'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { emitirNota } from '@/lib/fiscal/acoes'
import type { ObraNota, TomadorNota } from '@/lib/fiscal/tipos'
import { formatarMoeda } from '@/lib/formato'
import type { Recebimento } from '@/types'
import { buscarCep, mascararCep, mascararDocumento, OpcaoSelect } from './campos'

export type PrefillNota = {
  projetoId: string
  clienteId: string | null
  tomador: TomadorNota
  obra: ObraNota
  descricao: string
  recebimentos: Recebimento[]
  /** Parcelas que já têm nota autorizada. */
  parcelasComNota: string[]
  producao: boolean
}

type EnderecoForm = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  codigoMunicipio: string
}

const ENDERECO_VAZIO: EnderecoForm = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  codigoMunicipio: '',
}

function CamposEndereco({
  prefixo,
  valor,
  onChange,
}: {
  prefixo: string
  valor: EnderecoForm
  onChange: (v: EnderecoForm) => void
}) {
  async function aoMudarCep(texto: string) {
    const novo = { ...valor, cep: mascararCep(texto) }
    onChange(novo)
    const e = await buscarCep(texto)
    if (e) {
      onChange({
        ...novo,
        logradouro: novo.logradouro || e.logradouro,
        bairro: novo.bairro || e.bairro,
        cidade: e.cidade,
        uf: e.uf,
        codigoMunicipio: e.codigoMunicipio,
      })
    }
  }
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${prefixo}-cep`}>CEP</FieldLabel>
        <Input
          id={`${prefixo}-cep`}
          inputMode="numeric"
          className="tabular-nums"
          value={valor.cep}
          onChange={(e) => aoMudarCep(e.target.value)}
        />
        {valor.cidade && (
          <FieldDescription>
            {valor.cidade}/{valor.uf}
          </FieldDescription>
        )}
      </Field>
      <Field className="sm:col-span-4">
        <FieldLabel htmlFor={`${prefixo}-rua`}>Endereço</FieldLabel>
        <Input id={`${prefixo}-rua`} value={valor.logradouro} onChange={(e) => onChange({ ...valor, logradouro: e.target.value })} />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${prefixo}-nro`}>Número</FieldLabel>
        <Input id={`${prefixo}-nro`} value={valor.numero} onChange={(e) => onChange({ ...valor, numero: e.target.value })} />
      </Field>
      <Field className="sm:col-span-4">
        <FieldLabel htmlFor={`${prefixo}-bairro`}>Bairro</FieldLabel>
        <Input id={`${prefixo}-bairro`} value={valor.bairro} onChange={(e) => onChange({ ...valor, bairro: e.target.value })} />
      </Field>
    </div>
  )
}

function deEndereco(e: TomadorNota['endereco'] | ObraNota['endereco'] | null | undefined): EnderecoForm {
  if (!e) return ENDERECO_VAZIO
  return {
    cep: mascararCep(e.cep ?? ''),
    logradouro: e.logradouro ?? '',
    numero: e.numero ?? '',
    complemento: e.complemento ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    uf: e.uf ?? '',
    codigoMunicipio: e.codigoMunicipio ?? '',
  }
}

const SEM_PARCELA = 'nenhuma'

function Formulario({
  prefill,
  onEmitida,
  onCancelar,
}: {
  prefill: PrefillNota
  onEmitida: (fechar: boolean) => void
  onCancelar: () => void
}) {
  const livres = prefill.recebimentos.filter((r) => !prefill.parcelasComNota.includes(r.id))
  const primeira = livres.find((r) => r.recebido_em) ?? livres[0]
  const [parcela, setParcela] = useState(primeira?.id ?? SEM_PARCELA)
  const [valor, setValor] = useState<number | null>(primeira ? Number(primeira.valor) : null)
  const [descricao, setDescricao] = useState(prefill.descricao)
  const [documento, setDocumento] = useState(mascararDocumento(prefill.tomador.documento ?? ''))
  const [nome, setNome] = useState(prefill.tomador.nome)
  const [email, setEmail] = useState(prefill.tomador.email ?? '')
  const [endTomador, setEndTomador] = useState<EnderecoForm>(deEndereco(prefill.tomador.endereco))
  const [cno, setCno] = useState(prefill.obra.cno ?? '')
  const [endObra, setEndObra] = useState<EnderecoForm>(deEndereco(prefill.obra.endereco))
  const [erro, setErro] = useState<string | null>(null)
  const [emitindo, iniciar] = useTransition()

  const opcoesParcela = [
    { value: SEM_PARCELA, label: 'Sem parcela (valor livre)' },
    ...livres.map((r) => ({
      value: r.id,
      label: `${r.descricao} · ${formatarMoeda(Number(r.valor))}${r.recebido_em ? ' · recebida' : ''}`,
    })),
  ]

  function escolherParcela(id: string) {
    setParcela(id)
    const r = livres.find((x) => x.id === id)
    if (r) setValor(Number(r.valor))
  }

  useFormularioAssistente({
    id: 'nota-fiscal-emitir',
    titulo: 'Emitir nota fiscal de serviço',
    descricao: 'NFS-e da obra. Emitir só depois que a pessoa confirmar na tela.',
    campos: [
      { nome: 'valor', descricao: 'Valor da nota em reais', esquema: { type: 'number' } },
      { nome: 'descricao', descricao: 'Descrição do serviço que sai na nota', esquema: { type: 'string' } },
      { nome: 'documento', descricao: 'CPF ou CNPJ do cliente', esquema: { type: 'string' } },
      { nome: 'nome', descricao: 'Nome ou razão social do cliente', esquema: { type: 'string' } },
      { nome: 'cno', descricao: 'CNO (Cadastro Nacional de Obras) da obra', esquema: { type: 'string' } },
    ],
    valores: () => ({ valor, descricao, documento, nome, cno }),
    preencher: (v) => {
      if (typeof v.valor === 'number') setValor(v.valor)
      if (typeof v.descricao === 'string') setDescricao(v.descricao)
      if (typeof v.documento === 'string') setDocumento(mascararDocumento(v.documento))
      if (typeof v.nome === 'string') setNome(v.nome)
      if (typeof v.cno === 'string') setCno(v.cno)
    },
  })

  function emitir(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const tomadorEnd =
      endTomador.cep.replace(/\D/g, '').length === 8 && endTomador.codigoMunicipio
        ? {
            cep: endTomador.cep,
            codigoMunicipio: endTomador.codigoMunicipio,
            logradouro: endTomador.logradouro,
            numero: endTomador.numero,
            complemento: endTomador.complemento || null,
            bairro: endTomador.bairro,
            cidade: endTomador.cidade,
            uf: endTomador.uf,
          }
        : null
    const obraEnd =
      endObra.cep.replace(/\D/g, '').length === 8
        ? {
            cep: endObra.cep,
            logradouro: endObra.logradouro,
            numero: endObra.numero,
            complemento: endObra.complemento || null,
            bairro: endObra.bairro,
            codigoMunicipio: endObra.codigoMunicipio || null,
            cidade: endObra.cidade,
            uf: endObra.uf,
          }
        : null
    iniciar(async () => {
      const r = await emitirNota({
        projetoId: prefill.projetoId,
        clienteId: prefill.clienteId,
        recebimentoId: parcela === SEM_PARCELA ? null : parcela,
        valor: valor ?? 0,
        descricao,
        tomador: { documento, nome, email: email || null, telefone: prefill.tomador.telefone ?? null, endereco: tomadorEnd },
        obra: { cno: cno || null, endereco: obraEnd },
      })
      if (r.ok) {
        toast.success('Nota autorizada.')
        onEmitida(true)
      } else {
        setErro(r.erro)
        if (r.dados) onEmitida(false)
      }
    })
  }

  return (
    <form onSubmit={emitir} noValidate className="flex min-h-0 flex-col gap-4">
      <FieldGroup className="min-h-0 overflow-y-auto">
        {!prefill.producao && (
          <Alert variant="info">
            <CircleAlertIcon />
            <AlertTitle>Modo teste</AlertTitle>
            <AlertDescription>A nota vai para a produção restrita do gov.br e não tem valor fiscal.</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="nota-parcela">Parcela</FieldLabel>
            <OpcaoSelect id="nota-parcela" valor={parcela} opcoes={opcoesParcela} onChange={escolherParcela} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nota-valor">Valor</FieldLabel>
            <CampoMoeda id="nota-valor" valor={valor} onChange={setValor} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="nota-descricao">Descrição do serviço</FieldLabel>
          <Textarea id="nota-descricao" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Cliente (tomador)</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="nota-doc">CPF ou CNPJ</FieldLabel>
              <Input
                id="nota-doc"
                inputMode="numeric"
                className="tabular-nums"
                value={documento}
                onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="nota-nome">Nome</FieldLabel>
              <Input id="nota-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="nota-email">E-mail</FieldLabel>
              <Input id="nota-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <CamposEndereco prefixo="nota-tomador" valor={endTomador} onChange={setEndTomador} />
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Obra</FieldLegend>
          <Field>
            <FieldLabel htmlFor="nota-cno">CNO</FieldLabel>
            <Input id="nota-cno" inputMode="numeric" className="tabular-nums" value={cno} onChange={(e) => setCno(e.target.value)} />
            <FieldDescription>Cadastro Nacional de Obras. Sem CNO, informe o endereço da obra.</FieldDescription>
          </Field>
          {!cno.trim() && <CamposEndereco prefixo="nota-obra" valor={endObra} onChange={setEndObra} />}
        </FieldSet>

        {erro && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>A nota não foi autorizada</AlertTitle>
            <AlertDescription className="whitespace-pre-line">{erro}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={emitindo}>
          Fechar
        </Button>
        <Button type="submit" disabled={emitindo}>
          {emitindo && <Spinner data-icon="inline-start" />}
          {emitindo ? 'Emitindo…' : 'Emitir nota'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EmitirNotaDialog({
  aberto,
  onOpenChange,
  prefill,
  onEmitida,
}: {
  aberto: boolean
  onOpenChange: (v: boolean) => void
  prefill: PrefillNota
  onEmitida: (fechar: boolean) => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir nota fiscal</DialogTitle>
          <DialogDescription>NFS-e pelo emissor nacional, assinada com o certificado da empresa.</DialogDescription>
        </DialogHeader>
        {aberto && <Formulario prefill={prefill} onEmitida={onEmitida} onCancelar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
