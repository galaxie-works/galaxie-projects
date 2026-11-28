'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useFormularioAssistente } from '@/components/assistente/formulario-assistente'
import { CampoComVoz } from '@/components/clientes/campo-com-voz'
import { mascararCpf } from '@/components/clientes/documento'
import { paraE164 } from '@/components/clientes/telefone'
import { CampoData } from '@/components/projetos/campo-data'
import { CampoMoeda } from '@/components/projetos/campo-moeda'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { PhoneInput } from '@/components/reui/phone-input'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { BUCKET_FOTOS, UFS, caminhoFoto, mascararCep } from '@/lib/equipe'
import { VINCULO_EQUIPE_LABEL, type MembroEquipe, type VinculoEquipe } from '@/types'
import { FotoMembro } from './foto-membro'

type Campos = {
  nome: string
  funcao: string
  cpf: string
  data_nascimento: string
  telefone: string
  telefone_pessoal: string
  email: string
  cep: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  vinculo: string
  valor_diaria: number | null
  chave_pix: string
  data_inicio: string
  contato_emergencia_nome: string
  contato_emergencia_telefone: string
  observacoes: string
}

function iniciarCampos(m?: MembroEquipe | null): Campos {
  return {
    nome: m?.nome ?? '',
    funcao: m?.funcao ?? '',
    cpf: m?.cpf ?? '',
    data_nascimento: m?.data_nascimento ?? '',
    telefone: paraE164(m?.telefone),
    telefone_pessoal: paraE164(m?.telefone_pessoal),
    email: m?.email ?? '',
    cep: m?.cep ?? '',
    endereco: m?.endereco ?? '',
    bairro: m?.bairro ?? '',
    cidade: m?.cidade ?? '',
    uf: m?.uf ?? '',
    vinculo: m?.vinculo ?? '',
    valor_diaria: m?.valor_diaria ?? null,
    chave_pix: m?.chave_pix ?? '',
    data_inicio: m?.data_inicio ?? '',
    contato_emergencia_nome: m?.contato_emergencia_nome ?? '',
    contato_emergencia_telefone: paraE164(m?.contato_emergencia_telefone),
    observacoes: m?.observacoes ?? '',
  }
}

const VINCULOS = Object.entries(VINCULO_EQUIPE_LABEL).map(([value, label]) => ({ value, label }))
const ITENS_UF = UFS.map((uf) => ({ value: uf, label: uf }))
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: React.ReactNode
}) {
  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>{titulo}</FrameTitle>
        {descricao && <FrameDescription>{descricao}</FrameDescription>}
      </FrameHeader>
      <FramePanel>
        <FieldGroup>{children}</FieldGroup>
      </FramePanel>
    </Frame>
  )
}

export function MembroForm({
  empresaId,
  membro,
  fotoUrl,
}: {
  empresaId: string
  membro?: MembroEquipe | null
  fotoUrl?: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const formRef = useRef<HTMLFormElement>(null)
  const editando = Boolean(membro)

  const [c, setC] = useState<Campos>(() => iniciarCampos(membro))
  const [fotoNova, setFotoNova] = useState<File | null>(null)
  const [removerFoto, setRemoverFoto] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  function mudar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setC((atual) => ({ ...atual, [campo]: valor }))
  }

  // Preenche endereço pelo CEP (ViaCEP). Se falhar, a pessoa digita.
  // Campos vazios ou preenchidos por um CEP anterior são trocados; o que a
  // pessoa digitou à mão fica. Respostas atrasadas de CEPs antigos são ignoradas.
  const ultimoCep = useRef('')
  // Endereço já salvo junto com um CEP válido conta como vindo desse CEP:
  // trocar o CEP atualiza. Sem CEP salvo, o endereço foi digitado e fica.
  const temCepSalvo = (membro?.cep ?? '').replace(/\D/g, '').length === 8
  const doCep = useRef<Partial<Record<'endereco' | 'bairro' | 'cidade' | 'uf', string>>>(
    temCepSalvo
      ? {
          endereco: membro?.endereco ?? '',
          bairro: membro?.bairro ?? '',
          cidade: membro?.cidade ?? '',
          uf: membro?.uf ?? '',
        }
      : {}
  )
  async function buscarCep(cep: string) {
    const d = cep.replace(/\D/g, '')
    ultimoCep.current = d
    if (d.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (j.erro || ultimoCep.current !== d) return
      const novos = { endereco: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' }
      // O updater do setState roda depois; guarda os valores anteriores antes.
      const anteriores = doCep.current
      doCep.current = novos
      setC((atual) => {
        const prox = { ...atual }
        for (const k of ['endereco', 'bairro', 'cidade', 'uf'] as const) {
          if (!atual[k] || atual[k] === anteriores[k]) prox[k] = novos[k]
        }
        return prox
      })
    } catch {
      // sem rede ou serviço fora: segue sem preencher
    }
  }

  useFormularioAssistente({
    id: editando ? 'equipe-editar' : 'equipe-nova',
    titulo: editando ? `Editar ${membro?.nome}` : 'Nova pessoa da equipe',
    descricao: 'Cadastro de quem trabalha nas obras. Nome e profissão são obrigatórios.',
    campos: [
      { nome: 'nome', descricao: 'Nome completo', esquema: { type: 'string' } },
      { nome: 'funcao', descricao: 'Profissão, ex. pedreiro, eletricista', esquema: { type: 'string' } },
      { nome: 'cpf', descricao: 'CPF', esquema: { type: 'string' } },
      { nome: 'data_nascimento', descricao: 'Data de nascimento AAAA-MM-DD', esquema: { type: 'string' } },
      { nome: 'telefone', descricao: 'Telefone profissional em E.164, ex. +5511987654321', esquema: { type: 'string' } },
      { nome: 'telefone_pessoal', descricao: 'Telefone particular em E.164', esquema: { type: 'string' } },
      { nome: 'email', descricao: 'E-mail', esquema: { type: 'string' } },
      { nome: 'cep', descricao: 'CEP', esquema: { type: 'string' } },
      { nome: 'endereco', descricao: 'Rua, número e complemento', esquema: { type: 'string' } },
      { nome: 'bairro', descricao: 'Bairro', esquema: { type: 'string' } },
      { nome: 'cidade', descricao: 'Cidade', esquema: { type: 'string' } },
      { nome: 'uf', descricao: 'Estado (sigla)', esquema: { type: 'string', enum: [...UFS] } },
      { nome: 'vinculo', descricao: 'Tipo de vínculo', esquema: { type: 'string', enum: Object.keys(VINCULO_EQUIPE_LABEL) } },
      { nome: 'valor_diaria', descricao: 'Valor da diária em reais', esquema: { type: 'number' } },
      { nome: 'chave_pix', descricao: 'Chave PIX para pagamento', esquema: { type: 'string' } },
      { nome: 'data_inicio', descricao: 'Desde quando trabalha com a empresa, AAAA-MM-DD', esquema: { type: 'string' } },
      { nome: 'contato_emergencia_nome', descricao: 'Nome do contato de emergência', esquema: { type: 'string' } },
      { nome: 'contato_emergencia_telefone', descricao: 'Telefone do contato de emergência em E.164', esquema: { type: 'string' } },
      { nome: 'observacoes', descricao: 'Observações livres', esquema: { type: 'string' } },
    ],
    valores: () => ({ ...c }),
    preencher: (v) => {
      setC((atual) => {
        const novo = { ...atual }
        for (const [k, valor] of Object.entries(v)) {
          if (!(k in novo)) continue
          if (k === 'valor_diaria') {
            novo.valor_diaria = typeof valor === 'number' ? valor : valor == null ? null : Number(valor) || null
          } else if (typeof valor === 'string') {
            const texto =
              k === 'cpf' ? mascararCpf(valor) : k === 'cep' ? mascararCep(valor) : k === 'uf' ? valor.toUpperCase() : valor
            ;(novo as Record<string, unknown>)[k] = texto
          }
        }
        return novo
      })
    },
    salvar: () => formRef.current?.requestSubmit(),
  })

  const erros = {
    nome: !c.nome.trim() ? 'Informe o nome da pessoa.' : null,
    funcao: !c.funcao.trim() ? 'Informe a profissão.' : null,
    cpf: c.cpf && c.cpf.replace(/\D/g, '').length !== 11 ? 'CPF incompleto.' : null,
    email: c.email.trim() && !EMAIL_OK.test(c.email.trim()) ? 'E-mail inválido.' : null,
    cep: c.cep && c.cep.replace(/\D/g, '').length !== 8 ? 'CEP incompleto.' : null,
  }
  const mostrar = (k: keyof typeof erros) => (tentou ? erros[k] : null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (Object.values(erros).some(Boolean)) {
      toast.error('Confira os campos destacados')
      return
    }
    setSalvando(true)
    setErro(null)

    const anterior = membro?.foto_caminho ?? null
    let foto_caminho = removerFoto ? null : anterior
    if (fotoNova) {
      const caminho = caminhoFoto(empresaId, fotoNova)
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(caminho, fotoNova, { contentType: fotoNova.type || undefined })
      if (erroUpload) {
        setSalvando(false)
        setErro(`Não foi possível enviar a foto: ${erroUpload.message}`)
        return
      }
      foto_caminho = caminho
    }

    const t = (v: string) => v.trim() || null
    const campos = {
      nome: c.nome.trim(),
      funcao: c.funcao.trim(),
      cpf: t(c.cpf),
      data_nascimento: DATA_OK.test(c.data_nascimento) ? c.data_nascimento : null,
      telefone: t(c.telefone),
      telefone_pessoal: t(c.telefone_pessoal),
      email: t(c.email)?.toLowerCase() ?? null,
      cep: t(c.cep),
      endereco: t(c.endereco),
      bairro: t(c.bairro),
      cidade: t(c.cidade),
      uf: t(c.uf),
      vinculo: (t(c.vinculo) as VinculoEquipe | null) ?? null,
      valor_diaria: c.valor_diaria,
      chave_pix: t(c.chave_pix),
      data_inicio: DATA_OK.test(c.data_inicio) ? c.data_inicio : null,
      contato_emergencia_nome: t(c.contato_emergencia_nome),
      contato_emergencia_telefone: t(c.contato_emergencia_telefone),
      observacoes: t(c.observacoes),
      foto_caminho,
    }

    const { error } = membro
      ? await supabase.from('equipe').update(campos).eq('id', membro.id)
      : await supabase.from('equipe').insert({ empresa_id: empresaId, ...campos })

    if (error) {
      if (fotoNova && foto_caminho) await supabase.storage.from(BUCKET_FOTOS).remove([foto_caminho])
      setSalvando(false)
      setErro(error.message)
      return
    }
    // Foto antiga trocada ou removida: apaga do Storage.
    if (anterior && anterior !== foto_caminho) {
      await supabase.storage.from(BUCKET_FOTOS).remove([anterior])
    }

    toast.success(membro ? 'Dados atualizados' : `${campos.nome} entrou na equipe`)
    router.push('/equipe')
    router.refresh()
  }

  const fotoMostrada = removerFoto ? null : (fotoUrl ?? null)

  return (
    <form ref={formRef} onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Secao titulo="Identificação" descricao="Nome e profissão são obrigatórios.">
            <FotoMembro
              fotoAtual={fotoMostrada}
              onArquivo={setFotoNova}
              onRemoverAtual={() => setRemoverFoto(true)}
            />
            <Field data-invalid={!!mostrar('nome') || undefined}>
              <FieldLabel htmlFor="membro-nome">Nome</FieldLabel>
              <CampoComVoz
                id="membro-nome"
                value={c.nome}
                onChange={(v) => mudar('nome', v)}
                placeholder="Josué Ferreira"
                invalido={!!mostrar('nome')}
                autoFocus={!editando}
              />
              <FieldError>{mostrar('nome')}</FieldError>
            </Field>
            <Field data-invalid={!!mostrar('funcao') || undefined}>
              <FieldLabel htmlFor="membro-funcao">Profissão</FieldLabel>
              <CampoComVoz
                id="membro-funcao"
                value={c.funcao}
                onChange={(v) => mudar('funcao', v)}
                placeholder="Pedreiro, assentador de porcelanato"
                invalido={!!mostrar('funcao')}
              />
              <FieldError>{mostrar('funcao')}</FieldError>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!mostrar('cpf') || undefined}>
                <FieldLabel htmlFor="membro-cpf">CPF</FieldLabel>
                <Input
                  id="membro-cpf"
                  inputMode="numeric"
                  value={c.cpf}
                  onChange={(e) => mudar('cpf', mascararCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  aria-invalid={!!mostrar('cpf') || undefined}
                />
                <FieldError>{mostrar('cpf')}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-nascimento">Nascimento</FieldLabel>
                <CampoData
                  id="membro-nascimento"
                  valor={c.data_nascimento}
                  onChange={(v) => mudar('data_nascimento', v)}
                />
              </Field>
            </div>
          </Secao>

          <Secao titulo="Contato">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="membro-telefone">Telefone profissional</FieldLabel>
                <PhoneInput
                  id="membro-telefone"
                  defaultCountry="BR"
                  value={c.telefone}
                  onChange={(v) => mudar('telefone', v ?? '')}
                  placeholder="(11) 98765-4321"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-telefone-pessoal">Telefone particular</FieldLabel>
                <PhoneInput
                  id="membro-telefone-pessoal"
                  defaultCountry="BR"
                  value={c.telefone_pessoal}
                  onChange={(v) => mudar('telefone_pessoal', v ?? '')}
                  placeholder="(11) 91234-5678"
                />
              </Field>
            </div>
            <Field data-invalid={!!mostrar('email') || undefined}>
              <FieldLabel htmlFor="membro-email">E-mail</FieldLabel>
              <Input
                id="membro-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={c.email}
                onChange={(e) => mudar('email', e.target.value)}
                placeholder="josue@email.com"
                aria-invalid={!!mostrar('email') || undefined}
              />
              <FieldError>{mostrar('email')}</FieldError>
            </Field>
          </Secao>

          <Secao titulo="Contato de emergência">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="membro-emergencia-nome">Nome</FieldLabel>
                <Input
                  id="membro-emergencia-nome"
                  value={c.contato_emergencia_nome}
                  onChange={(e) => mudar('contato_emergencia_nome', e.target.value)}
                  placeholder="Maria (esposa)"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-emergencia-telefone">Telefone</FieldLabel>
                <PhoneInput
                  id="membro-emergencia-telefone"
                  defaultCountry="BR"
                  value={c.contato_emergencia_telefone}
                  onChange={(v) => mudar('contato_emergencia_telefone', v ?? '')}
                  placeholder="(11) 99876-5432"
                />
              </Field>
            </div>
          </Secao>
        </div>

        <div className="flex flex-col gap-6">
          <Secao titulo="Endereço">
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field data-invalid={!!mostrar('cep') || undefined}>
                <FieldLabel htmlFor="membro-cep">CEP</FieldLabel>
                <Input
                  id="membro-cep"
                  inputMode="numeric"
                  value={c.cep}
                  onChange={(e) => {
                    const cep = mascararCep(e.target.value)
                    mudar('cep', cep)
                    buscarCep(cep)
                  }}
                  placeholder="00000-000"
                  aria-invalid={!!mostrar('cep') || undefined}
                />
                <FieldError>{mostrar('cep')}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-endereco">Rua, número e complemento</FieldLabel>
                <Input
                  id="membro-endereco"
                  value={c.endereco}
                  onChange={(e) => mudar('endereco', e.target.value)}
                  placeholder="Rua das Palmeiras, 120, casa 2"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
              <Field>
                <FieldLabel htmlFor="membro-bairro">Bairro</FieldLabel>
                <Input id="membro-bairro" value={c.bairro} onChange={(e) => mudar('bairro', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-cidade">Cidade</FieldLabel>
                <Input id="membro-cidade" value={c.cidade} onChange={(e) => mudar('cidade', e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-uf">UF</FieldLabel>
                <Select items={ITENS_UF} value={c.uf || null} onValueChange={(v) => mudar('uf', (v as string | null) ?? '')}>
                  <SelectTrigger id="membro-uf" className="w-full">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITENS_UF.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Secao>

          <Secao titulo="Trabalho">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="membro-vinculo">Vínculo</FieldLabel>
                <Select
                  items={VINCULOS}
                  value={c.vinculo || null}
                  onValueChange={(v) => mudar('vinculo', (v as string | null) ?? '')}
                >
                  <SelectTrigger id="membro-vinculo" className="w-full">
                    <SelectValue placeholder="Escolher" />
                  </SelectTrigger>
                  <SelectContent>
                    {VINCULOS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-inicio">Trabalha com você desde</FieldLabel>
                <CampoData id="membro-inicio" valor={c.data_inicio} onChange={(v) => mudar('data_inicio', v)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-diaria">Valor da diária</FieldLabel>
                <CampoMoeda id="membro-diaria" valor={c.valor_diaria} onChange={(v) => mudar('valor_diaria', v)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="membro-pix">Chave PIX</FieldLabel>
                <Input
                  id="membro-pix"
                  value={c.chave_pix}
                  onChange={(e) => mudar('chave_pix', e.target.value)}
                  placeholder="CPF, celular, e-mail ou chave aleatória"
                />
              </Field>
            </div>
          </Secao>

          <Secao titulo="Observações">
            <Field>
              <FieldLabel htmlFor="membro-obs" className="sr-only">
                Observações
              </FieldLabel>
              <Textarea
                id="membro-obs"
                value={c.observacoes}
                onChange={(e) => mudar('observacoes', e.target.value)}
                placeholder="Especialidades, ferramentas próprias, disponibilidade, tamanho de uniforme…"
                rows={4}
              />
            </Field>
          </Secao>
        </div>
      </div>

      {erro && <FieldError>{erro}</FieldError>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" nativeButton={false} render={<Link href="/equipe" />} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando && <Spinner data-icon="inline-start" />}
          {editando ? 'Salvar' : 'Adicionar pessoa'}
        </Button>
      </div>
    </form>
  )
}
