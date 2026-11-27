'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CampoData } from '@/components/projetos/campo-data'
import { PhoneInput } from '@/components/reui/phone-input'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { PosVenda } from '@/types'

// Texto com ditado: a fala é acrescentada ao que já estava escrito.
function TextoComVoz({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <InputGroup>
      <InputGroupTextarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <BotaoVoz
          size="icon-xs"
          rotulo="Ditar"
          onFinal={(falado) => onChange(value ? `${value} ${falado}` : falado)}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}

function Rodape({
  salvando,
  rotulo,
  onCancelar,
  desabilitado,
}: {
  salvando: boolean
  rotulo: string
  onCancelar: () => void
  desabilitado?: boolean
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
        Cancelar
      </Button>
      <Button type="submit" disabled={salvando || desabilitado}>
        {salvando && <Spinner data-icon="inline-start" />}
        {rotulo}
      </Button>
    </DialogFooter>
  )
}

// ---------------------------------------------------------------------------
// Pesquisa de satisfação: nota de 0 a 10 + comentário.
// ---------------------------------------------------------------------------
export function NotaDialog({
  item,
  onOpenChange,
  onSalvo,
}: {
  item: PosVenda | null
  onOpenChange: (aberto: boolean) => void
  onSalvo: () => void
}) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {item && <NotaForm key={item.id} item={item} onFechar={() => onOpenChange(false)} onSalvo={onSalvo} />}
      </DialogContent>
    </Dialog>
  )
}

function NotaForm({ item, onFechar, onSalvo }: { item: PosVenda; onFechar: () => void; onSalvo: () => void }) {
  const [nota, setNota] = useState<string>(item.nota_0_10 != null ? String(item.nota_0_10) : '')
  const [comentario, setComentario] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (nota === '') return
    setSalvando(true)
    const { error } = await createClient()
      .from('pos_venda')
      .update({
        nota_0_10: Number(nota),
        texto: comentario.trim() || item.texto,
        status: 'resolvido',
        resolvido_em: new Date().toISOString(),
      })
      .eq('id', item.id)
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível salvar a nota', { description: error.message })
      return
    }
    toast.success(`Nota ${nota} registrada`)
    onSalvo()
    onFechar()
  }

  const n = nota === '' ? null : Number(nota)
  const leitura =
    n == null ? 'Escolha a nota que o cliente deu.' : n >= 9 ? 'Promotor: bom momento para pedir indicação.' : n >= 7 ? 'Neutro.' : 'Detrator: vale ligar e entender o que faltou.'

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Pesquisa de satisfação</DialogTitle>
        <DialogDescription>De 0 a 10, quanto o cliente recomendaria a empresa?</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Nota</FieldLabel>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={nota === '' ? [] : [nota]}
            onValueChange={(v) => setNota((v[0] as string | undefined) ?? '')}
            aria-label="Nota de 0 a 10"
            className="flex-wrap"
          >
            {Array.from({ length: 11 }, (_, i) => String(i)).map((v) => (
              <ToggleGroupItem key={v} value={v} className="min-w-9 tabular-nums">
                {v}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>{leitura}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="pesquisa-comentario">Comentário</FieldLabel>
          <TextoComVoz
            id="pesquisa-comentario"
            value={comentario}
            onChange={setComentario}
            placeholder="O que o cliente disse? (opcional)"
          />
        </Field>
      </FieldGroup>
      <Rodape salvando={salvando} rotulo="Salvar nota" onCancelar={onFechar} desabilitado={nota === ''} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Agendar revisão ou chamado.
// ---------------------------------------------------------------------------
export function AgendarDialog({
  item,
  onOpenChange,
  onSalvo,
}: {
  item: PosVenda | null
  onOpenChange: (aberto: boolean) => void
  onSalvo: () => void
}) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {item && <AgendarForm key={item.id} item={item} onFechar={() => onOpenChange(false)} onSalvo={onSalvo} />}
      </DialogContent>
    </Dialog>
  )
}

function AgendarForm({ item, onFechar, onSalvo }: { item: PosVenda; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(item.vence_em ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    setSalvando(true)
    const { error } = await createClient()
      .from('pos_venda')
      .update({ vence_em: data, status: 'agendado' })
      .eq('id', item.id)
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível agendar', { description: error.message })
      return
    }
    toast.success('Agendado')
    onSalvo()
    onFechar()
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Agendar visita</DialogTitle>
        <DialogDescription>Quando a equipe vai ao cliente.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="agendar-data">Data</FieldLabel>
        <CampoData id="agendar-data" valor={data} onChange={setData} />
      </Field>
      <Rodape salvando={salvando} rotulo="Agendar" onCancelar={onFechar} desabilitado={!data} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Chamado de assistência.
// ---------------------------------------------------------------------------
export type DadosCliente = { id: string; empresa_id: string; nome: string; telefone: string | null }

export function ChamadoDialog({
  aberto,
  onOpenChange,
  cliente,
  obras,
  projetoInicial,
  onSalvo,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  cliente: DadosCliente
  obras: { id: string; nome: string }[]
  projetoInicial: string | null
  onSalvo: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {aberto && (
          <ChamadoForm
            cliente={cliente}
            obras={obras}
            projetoInicial={projetoInicial}
            onFechar={() => onOpenChange(false)}
            onSalvo={onSalvo}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const SEM_OBRA = '__sem_obra__'

function ChamadoForm({
  cliente,
  obras,
  projetoInicial,
  onFechar,
  onSalvo,
}: {
  cliente: DadosCliente
  obras: { id: string; nome: string }[]
  projetoInicial: string | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [projetoId, setProjetoId] = useState(projetoInicial ?? obras[0]?.id ?? SEM_OBRA)
  const [texto, setTexto] = useState('')
  const [data, setData] = useState('')
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const itensObra = [...obras.map((o) => ({ value: o.id, label: o.nome })), { value: SEM_OBRA, label: 'Sem obra' }]
  const erro = tentou && !texto.trim() ? 'Descreva o problema.' : null

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!texto.trim()) return
    setSalvando(true)
    const { error } = await createClient()
      .from('pos_venda')
      .insert({
        empresa_id: cliente.empresa_id,
        cliente_id: cliente.id,
        projeto_id: projetoId === SEM_OBRA ? null : projetoId,
        tipo: 'assistencia',
        titulo: 'Chamado de assistência',
        texto: texto.trim(),
        vence_em: data || null,
        status: data ? 'agendado' : 'aberto',
      })
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível abrir o chamado', { description: error.message })
      return
    }
    toast.success('Chamado aberto')
    onSalvo()
    onFechar()
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Abrir chamado</DialogTitle>
        <DialogDescription>Problema relatado por {cliente.nome} depois da entrega.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {!projetoInicial && obras.length > 0 && (
          <Field>
            <FieldLabel htmlFor="chamado-obra">Obra</FieldLabel>
            <Select items={itensObra} value={projetoId} onValueChange={(v) => v && setProjetoId(v as string)}>
              <SelectTrigger id="chamado-obra" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itensObra.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field data-invalid={!!erro || undefined}>
          <FieldLabel htmlFor="chamado-texto">O que aconteceu</FieldLabel>
          <TextoComVoz
            id="chamado-texto"
            value={texto}
            onChange={setTexto}
            placeholder="Ex.: rejunte do box soltando, infiltração no teto da sala"
          />
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="chamado-data">Visita agendada</FieldLabel>
          <CampoData id="chamado-data" valor={data} onChange={setData} placeholder="Sem data ainda" />
        </Field>
      </FieldGroup>
      <Rodape salvando={salvando} rotulo="Abrir chamado" onCancelar={onFechar} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Indicação: o indicado vira cliente lead, com origem "Indicação".
// ---------------------------------------------------------------------------
export function IndicacaoDialog({
  aberto,
  onOpenChange,
  cliente,
  onSalvo,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  cliente: DadosCliente
  onSalvo: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {aberto && <IndicacaoForm cliente={cliente} onFechar={() => onOpenChange(false)} onSalvo={onSalvo} />}
      </DialogContent>
    </Dialog>
  )
}

function IndicacaoForm({
  cliente,
  onFechar,
  onSalvo,
}: {
  cliente: DadosCliente
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacao, setObservacao] = useState('')
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const erro = tentou && !nome.trim() ? 'Informe o nome de quem foi indicado.' : null

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim()) return
    setSalvando(true)
    const supabase = createClient()
    const { data: novo, error } = await supabase
      .from('clientes')
      .insert({
        empresa_id: cliente.empresa_id,
        tipo: 'PF',
        nome: nome.trim(),
        telefone: telefone || null,
        origem: 'Indicação',
        indicado_por_id: cliente.id,
        observacoes: observacao.trim() || `Indicado por ${cliente.nome}`,
      })
      .select('id')
      .single()
    if (error || !novo) {
      setSalvando(false)
      toast.error('Não foi possível cadastrar a indicação', { description: error?.message })
      return
    }
    const { error: erroPv } = await supabase.from('pos_venda').insert({
      empresa_id: cliente.empresa_id,
      cliente_id: cliente.id,
      tipo: 'indicacao',
      titulo: `Indicou ${nome.trim()}`,
      texto: observacao.trim() || null,
      indicado_cliente_id: novo.id,
      status: 'resolvido',
      resolvido_em: new Date().toISOString(),
    })
    setSalvando(false)
    if (erroPv) {
      toast.error('Cliente criado, mas a indicação não ficou registrada', { description: erroPv.message })
    } else {
      toast.success(`${nome.trim()} cadastrado como lead`, { description: `Indicação de ${cliente.nome}` })
    }
    onSalvo()
    onFechar()
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Registrar indicação</DialogTitle>
        <DialogDescription>
          Quem {cliente.nome.split(' ')[0]} indicou entra como cliente novo, com origem Indicação.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={!!erro || undefined}>
          <FieldLabel htmlFor="indicacao-nome">Nome</FieldLabel>
          <Input
            id="indicacao-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome de quem foi indicado"
            aria-invalid={!!erro || undefined}
            autoFocus
          />
          {erro && <FieldError>{erro}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="indicacao-telefone">Telefone</FieldLabel>
          <PhoneInput
            id="indicacao-telefone"
            defaultCountry="BR"
            value={telefone}
            onChange={(v) => setTelefone(v ?? '')}
            placeholder="(11) 98765-4321"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="indicacao-obs">O que ele precisa</FieldLabel>
          <TextoComVoz
            id="indicacao-obs"
            value={observacao}
            onChange={setObservacao}
            placeholder="Ex.: quer trocar o piso da área gourmet (opcional)"
          />
        </Field>
      </FieldGroup>
      <Rodape salvando={salvando} rotulo="Cadastrar indicação" onCancelar={onFechar} />
    </form>
  )
}
