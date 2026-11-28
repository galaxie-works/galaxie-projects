'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlusIcon, UsersIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_PROJETO_LABEL, type Cliente, type Projeto, type StatusProjeto } from '@/types'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { CampoData } from '@/components/projetos/campo-data'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { OrcamentoEditor } from '@/components/orcamento/orcamento-editor'
import { OrcamentoResumo } from '@/components/orcamento/orcamento-resumo'
import { salvarOrcamento } from '@/components/orcamento/dados'
import { formatarMoeda } from '@/lib/formato'
import {
  LISTA_UNIDADES,
  limparOrcamento,
  novaArea,
  novoItem,
  totalOrcamento,
  type AreaOrcamento,
  type TabelaPrecos,
  type Unidade,
} from '@/lib/orcamento'
import { SERVICOS_POR_ID } from '@/lib/servicos'
import { useFormularioAssistente } from '@/components/assistente/formulario-assistente'

const ITENS_STATUS = (Object.entries(STATUS_PROJETO_LABEL) as [StatusProjeto, string][]).map(
  ([value, label]) => ({ value, label })
)

type Props = {
  empresaId: string
  clientes: Cliente[]
  clienteIdInicial?: string
  /** Quando presente, o formulário edita este projeto em vez de criar um novo. */
  projeto?: Projeto
  /** Chamado após salvar uma edição (ex.: fechar o Dialog). */
  onSalvo?: () => void
  onCancelar?: () => void
  /**
   * Novo projeto com áreas e medidas: o orçamento sai das medidas e dos
   * preços dos serviços da empresa.
   */
  orcamento?: { servicosEmpresa: string[]; precos: TabelaPrecos }
  /** Edição de projeto cujo total vem das áreas (aba Orçamento). */
  totalCalculado?: boolean
}

type Erros = { nome?: string; cliente?: string; prazo?: string }

export function ProjetoForm({
  empresaId,
  clientes,
  clienteIdInicial,
  projeto,
  onSalvo,
  onCancelar,
  orcamento: configOrcamento,
  totalCalculado = false,
}: Props) {
  const router = useRouter()
  const editando = Boolean(projeto)

  const [nome, setNome] = useState(projeto?.nome ?? '')
  const [clienteId, setClienteId] = useState(
    projeto?.cliente_id ?? clienteIdInicial ?? clientes[0]?.id ?? ''
  )
  const [status, setStatus] = useState<StatusProjeto>(projeto?.status ?? 'planejamento')
  const [dataInicio, setDataInicio] = useState(projeto?.data_inicio?.slice(0, 10) ?? '')
  const [dataPrazo, setDataPrazo] = useState(projeto?.data_prazo?.slice(0, 10) ?? '')
  const [orcamento, setOrcamento] = useState<number | null>(
    projeto?.orcamento_total != null ? Number(projeto.orcamento_total) : null
  )
  const [areas, setAreas] = useState<AreaOrcamento[]>([])
  const temItens = limparOrcamento(areas).some((a) => a.itens.length > 0)
  const totalAreas = totalOrcamento(areas)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const itensCliente = clientes.map((c) => ({ value: c.id, label: c.nome }))
  const formRef = useRef<HTMLFormElement>(null)

  // O assistente de IA preenche este formulário por voz, inclusive as áreas
  // e medidas do orçamento. Os preços saem da tabela da empresa.
  const servicosOrcamento = configOrcamento?.servicosEmpresa ?? []
  const unidades = LISTA_UNIDADES.map((u) => u.value)
  useFormularioAssistente({
    id: editando ? 'projeto-editar' : 'projeto-novo',
    titulo: editando ? 'Editar projeto' : 'Novo projeto',
    descricao:
      'Dados da obra' +
      (configOrcamento ? ' e orçamento por áreas (cômodos) com medidas por serviço' : ''),
    campos: [
      { nome: 'nome', descricao: 'Nome do projeto/obra', esquema: { type: 'string' } },
      {
        nome: 'cliente_id',
        descricao:
          'Cliente da obra. Opções (id = nome): ' + clientes.map((c) => `${c.id} = ${c.nome}`).join('; '),
        esquema: { type: 'string', enum: clientes.map((c) => c.id) },
      },
      {
        nome: 'status',
        descricao: 'Status do projeto',
        esquema: { type: 'string', enum: Object.keys(STATUS_PROJETO_LABEL) },
      },
      { nome: 'data_inicio', descricao: 'Início, AAAA-MM-DD', esquema: { type: 'string' } },
      { nome: 'data_prazo', descricao: 'Prazo final, AAAA-MM-DD', esquema: { type: 'string' } },
      ...(totalCalculado
        ? []
        : [
            {
              nome: 'orcamento_total',
              descricao: configOrcamento
                ? 'Valor total em reais. Só use se não houver áreas; com áreas o total é calculado.'
                : 'Valor total em reais',
              esquema: { type: 'number' },
            },
          ]),
      ...(configOrcamento && servicosOrcamento.length
        ? [
            {
              nome: 'areas',
              descricao:
                'Orçamento por área (cômodo). Mande a lista COMPLETA de áreas (substitui a atual). ' +
                'Cada item é um serviço com quantidade; o preço vem da tabela da empresa. ' +
                'Serviços (id = nome): ' +
                servicosOrcamento.map((id) => `${id} = ${SERVICOS_POR_ID[id]?.servico.nome ?? id}`).join('; '),
              esquema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    nome: { type: 'string', description: 'Nome da área, ex. Sala, Cozinha' },
                    itens: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          servico_id: { type: 'string', enum: servicosOrcamento },
                          quantidade: { type: 'number' },
                          unidade: { type: 'string', enum: unidades, description: 'm2, ml (metro linear), un...' },
                          memoria_calculo: { type: 'string', description: 'Conta falada, ex. 4 x 3,5' },
                        },
                        required: ['servico_id', 'quantidade'],
                      },
                    },
                  },
                  required: ['nome'],
                },
              },
            },
          ]
        : []),
    ],
    valores: () => ({
      nome,
      cliente_id: clienteId,
      status,
      data_inicio: dataInicio,
      data_prazo: dataPrazo,
      ...(totalCalculado ? {} : { orcamento_total: orcamento }),
      ...(configOrcamento
        ? {
            areas: areas.map((a) => ({
              nome: a.nome,
              itens: a.itens.map((i) => ({
                servico_id: i.servico_id,
                quantidade: i.quantidade,
                unidade: i.unidade,
                memoria_calculo: i.memoria_calculo,
              })),
            })),
          }
        : {}),
    }),
    preencher: (v) => {
      const texto = (x: unknown) => (typeof x === 'string' ? x : undefined)
      const data = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : undefined)
      if (texto(v.nome) !== undefined) setNome(texto(v.nome)!)
      if (typeof v.cliente_id === 'string' && clientes.some((c) => c.id === v.cliente_id)) setClienteId(v.cliente_id)
      if (typeof v.status === 'string' && v.status in STATUS_PROJETO_LABEL) setStatus(v.status as StatusProjeto)
      if (data(v.data_inicio)) setDataInicio(data(v.data_inicio)!)
      if (data(v.data_prazo)) setDataPrazo(data(v.data_prazo)!)
      if (typeof v.orcamento_total === 'number' && !totalCalculado) setOrcamento(v.orcamento_total)
      if (configOrcamento && Array.isArray(v.areas)) {
        const permitidos = new Set(servicosOrcamento)
        setAreas(
          v.areas
            .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
            .map((a) => {
              const area = novaArea(String(a.nome ?? '').trim() || 'Área')
              const itens = Array.isArray(a.itens) ? a.itens : []
              area.itens = itens
                .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
                .filter((i) => typeof i.servico_id === 'string' && permitidos.has(i.servico_id))
                .map((i) => {
                  const item = novoItem(i.servico_id as string, configOrcamento.precos)
                  const qtd = Number(i.quantidade)
                  if (Number.isFinite(qtd) && qtd > 0) item.quantidade = Math.round(qtd * 1000) / 1000
                  if (typeof i.unidade === 'string' && unidades.includes(i.unidade as Unidade)) {
                    item.unidade = i.unidade as Unidade
                  }
                  if (typeof i.memoria_calculo === 'string') item.memoria_calculo = i.memoria_calculo
                  return item
                })
              return area
            }),
        )
      }
    },
    salvar: () => formRef.current?.requestSubmit(),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const novosErros: Erros = {}
    if (!nome.trim()) novosErros.nome = 'Dê um nome para o projeto.'
    if (!clienteId) novosErros.cliente = 'Selecione o cliente deste projeto.'
    if (dataInicio && dataPrazo && dataPrazo < dataInicio)
      novosErros.prazo = 'O prazo final vem antes do início.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setSalvando(true)
    setErroGeral(null)
    const supabase = createClient()
    const campos = {
      cliente_id: clienteId,
      nome: nome.trim(),
      status,
      data_inicio: dataInicio || null,
      data_prazo: dataPrazo || null,
      // Quando o total vem das áreas, quem atualiza é a aba Orçamento.
      ...(totalCalculado ? {} : { orcamento_total: temItens ? totalAreas : (orcamento ?? 0) }),
    }

    if (projeto) {
      const { error } = await supabase.from('projetos').update(campos).eq('id', projeto.id)
      setSalvando(false)
      if (error) {
        setErroGeral(error.message)
        return
      }
      toast.success('Projeto atualizado')
      onSalvo?.()
      router.refresh()
      return
    }

    const { data, error } = await supabase
      .from('projetos')
      .insert({ empresa_id: empresaId, ...campos })
      .select('id')
      .single()

    if (error || !data) {
      setSalvando(false)
      setErroGeral(error?.message ?? 'Erro ao salvar projeto.')
      return
    }
    if (configOrcamento && limparOrcamento(areas).length > 0) {
      const { erro } = await salvarOrcamento(supabase, {
        projetoId: data.id,
        empresaId,
        areas,
        precos: configOrcamento.precos,
      })
      if (erro) toast.error('O projeto foi criado, mas as áreas não foram salvas', { description: erro })
    }
    setSalvando(false)
    toast.success('Projeto criado')
    router.push(`/projetos/${data.id}`)
    router.refresh()
  }

  if (clientes.length === 0) {
    const vazio = (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>Cadastre um cliente primeiro</EmptyTitle>
          <EmptyDescription>Todo projeto pertence a um cliente.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/clientes/novo" />}>
            <UserPlusIcon data-icon="inline-start" />
            Cadastrar cliente
          </Button>
        </EmptyContent>
      </Empty>
    )
    return configOrcamento ? (
      <Frame spacing="default">
        <FramePanel>{vazio}</FramePanel>
      </Frame>
    ) : (
      vazio
    )
  }

  const camposForm = (
      <FieldGroup>
        <Field data-invalid={Boolean(erros.nome) || undefined}>
          <FieldLabel htmlFor="projeto-nome">Nome do projeto</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="projeto-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Porcelanato sala e cozinha — Ap. 52"
              aria-invalid={Boolean(erros.nome) || undefined}
              autoFocus={!editando}
            />
            <InputGroupAddon align="inline-end">
              <BotaoVoz size="icon-xs" rotulo="Ditar o nome" onParcial={setNome} onFinal={setNome} />
            </InputGroupAddon>
          </InputGroup>
          {erros.nome && <FieldError>{erros.nome}</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(erros.cliente) || undefined}>
            <FieldLabel htmlFor="projeto-cliente">Cliente</FieldLabel>
            <Select
              items={itensCliente}
              value={clienteId}
              onValueChange={(v) => setClienteId((v as string | null) ?? '')}
            >
              <SelectTrigger id="projeto-cliente" className="w-full">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {itensCliente.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.cliente && <FieldError>{erros.cliente}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="projeto-status">Status</FieldLabel>
            <Select
              items={ITENS_STATUS}
              value={status}
              onValueChange={(v) => v && setStatus(v as StatusProjeto)}
            >
              <SelectTrigger id="projeto-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITENS_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="projeto-orcamento">Orçamento total</FieldLabel>
          {temItens || totalCalculado ? (
            <p id="projeto-orcamento" className="text-sm text-muted-foreground">
              {temItens ? (
                <>
                  <span className="font-medium text-foreground tabular-nums">{formatarMoeda(totalAreas)}</span>{' '}
                  calculado pelas áreas e medidas.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatarMoeda(Number(projeto?.orcamento_total ?? 0))}
                  </span>{' '}
                  calculado pelas áreas. Mude na aba Orçamento.
                </>
              )}
            </p>
          ) : (
            <CampoMoeda id="projeto-orcamento" valor={orcamento} onChange={setOrcamento} />
          )}
          {configOrcamento && !temItens && (
            <FieldDescription>Ou monte o orçamento por área logo abaixo.</FieldDescription>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="projeto-inicio">Início</FieldLabel>
            <CampoData id="projeto-inicio" valor={dataInicio} onChange={setDataInicio} />
          </Field>
          <Field data-invalid={Boolean(erros.prazo) || undefined}>
            <FieldLabel htmlFor="projeto-prazo">Prazo final</FieldLabel>
            <CampoData
              id="projeto-prazo"
              valor={dataPrazo}
              onChange={setDataPrazo}
              invalido={Boolean(erros.prazo)}
            />
            {erros.prazo && <FieldError>{erros.prazo}</FieldError>}
          </Field>
        </div>
      </FieldGroup>
  )

  const rodape = (
    <>
      {erroGeral && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{erroGeral}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancelar ? (
          <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        ) : (
          <Button variant="outline" nativeButton={false} render={<Link href="/projetos" />}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          {editando ? 'Salvar alterações' : 'Criar projeto'}
        </Button>
      </div>
    </>
  )

  if (!configOrcamento) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {camposForm}
        {rodape}
      </form>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Frame spacing="default">
        <FrameHeader>
          <FrameTitle>Dados do projeto</FrameTitle>
        </FrameHeader>
        <FramePanel>{camposForm}</FramePanel>
      </Frame>
      <OrcamentoEditor
        areas={areas}
        onChange={setAreas}
        servicosEmpresa={configOrcamento.servicosEmpresa}
        precos={configOrcamento.precos}
      />
      <OrcamentoResumo areas={areas} />
      {rodape}
    </form>
  )
}
