'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2Icon, HammerIcon, TagIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { mascararCnpj } from '@/components/clientes/documento'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { PrecosServicos } from '@/components/orcamento/precos-servicos'
import { ServicosPicker } from '@/components/servicos/servicos-picker'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TabelaPrecos } from '@/lib/orcamento'
import type { Empresa } from '@/types'

// Texto longo com ditado: a fala é acrescentada ao que já estava escrito.
function TextoComVoz({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
}) {
  const base = useRef<string | null>(null)
  return (
    <InputGroup>
      <InputGroupTextarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <BotaoVoz
          size="icon-xs"
          rotulo="Ditar texto"
          onParcial={(texto) => {
            if (base.current === null) base.current = value.trim()
            onChange(base.current ? `${base.current} ${texto}` : texto)
          }}
          onFinal={() => {
            base.current = null
          }}
        />
      </InputGroupAddon>
    </InputGroup>
  )
}

export function EmpresaForm({ empresa, precos: precosIniciais }: { empresa: Empresa; precos: TabelaPrecos }) {
  const router = useRouter()
  const supabase = createClient()
  const [nome, setNome] = useState(empresa.nome)
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? '')
  const [descricao, setDescricao] = useState(empresa.descricao ?? '')
  const [modoOperacao, setModoOperacao] = useState(empresa.modo_operacao ?? '')
  const [servicos, setServicos] = useState<string[]>(empresa.servicos ?? [])
  const [precos, setPrecos] = useState<TabelaPrecos>(precosIniciais)
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const erroNome = tentou && !nome.trim() ? 'Informe o nome da empresa.' : null

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim()) return
    setSalvando(true)
    const { error } = await supabase
      .from('empresas')
      .update({
        nome,
        cnpj: cnpj || null,
        descricao: descricao || null,
        modo_operacao: modoOperacao || null,
        servicos,
      })
      .eq('id', empresa.id)
    const linhasPreco = Object.entries(precos)
      .filter(([id]) => servicos.includes(id))
      .map(([servico_id, p]) => ({
        empresa_id: empresa.id,
        servico_id,
        unidade: p.unidade,
        preco: p.preco,
        updated_at: new Date().toISOString(),
      }))
    const { error: erroPrecos } =
      !error && linhasPreco.length > 0
        ? await supabase.from('precos_servicos').upsert(linhasPreco)
        : { error: null }
    setSalvando(false)
    if (error || erroPrecos) {
      toast.error('Não foi possível salvar', { description: (error ?? erroPrecos)?.message })
      return
    }
    toast.success('Alterações salvas')
    router.refresh()
  }

  const rodape = (
    <FrameFooter className="flex-row justify-end">
      <Button type="submit" disabled={salvando}>
        {salvando && <Spinner data-icon="inline-start" />}
        {salvando ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </FrameFooter>
  )

  return (
    <form onSubmit={salvar} noValidate>
      <Tabs defaultValue="dados" orientation="vertical" className="flex-col gap-6 md:flex-row">
        <TabsList
          variant="line"
          aria-label="Seções da empresa"
          className="w-full flex-row justify-start md:w-48 md:flex-col"
        >
          <TabsTrigger value="dados" className="flex-none md:flex-1">
            <Building2Icon />
            Dados
          </TabsTrigger>
          <TabsTrigger value="servicos" className="flex-none md:flex-1">
            <HammerIcon />
            Serviços
            {servicos.length > 0 && (
              <Badge variant="outline" className="tabular-nums">
                {servicos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="precos" className="flex-none md:flex-1">
            <TagIcon />
            Preços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="min-w-0">
          <Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Dados da empresa</FrameTitle>
              <FrameDescription>Aparecem nos orçamentos e na sua página.</FrameDescription>
            </FrameHeader>
            <FramePanel>
              <FieldGroup>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={!!erroNome || undefined}>
                    <FieldLabel htmlFor="empresa-nome">Nome da empresa</FieldLabel>
                    <Input
                      id="empresa-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      aria-invalid={!!erroNome || undefined}
                    />
                    <FieldError>{erroNome}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="empresa-cnpj">CNPJ</FieldLabel>
                    <Input
                      id="empresa-cnpj"
                      inputMode="numeric"
                      value={cnpj}
                      onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      className="tabular-nums"
                    />
                    <FieldDescription>Opcional.</FieldDescription>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="empresa-descricao">O que a empresa faz</FieldLabel>
                  <TextoComVoz
                    id="empresa-descricao"
                    value={descricao}
                    onChange={setDescricao}
                    placeholder="Reformas residenciais completas, com foco em pisos e revestimentos."
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="empresa-modo">Como você conduz as obras</FieldLabel>
                  <TextoComVoz
                    id="empresa-modo"
                    value={modoOperacao}
                    onChange={setModoOperacao}
                    placeholder="Faço a visita técnica, mando o orçamento em 48 h e acompanho a obra toda semana."
                  />
                  <FieldDescription>
                    Ajuda o assistente a organizar etapas e prazos do seu jeito.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FramePanel>
            {rodape}
          </Frame>
        </TabsContent>

        <TabsContent value="servicos" className="min-w-0">
          <Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Serviços</FrameTitle>
              <FrameDescription>O que você oferece aos clientes.</FrameDescription>
            </FrameHeader>
            <FramePanel>
              <ServicosPicker value={servicos} onChange={setServicos} />
            </FramePanel>
            {rodape}
          </Frame>
        </TabsContent>

        <TabsContent value="precos" className="min-w-0">
          <Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Preços dos serviços</FrameTitle>
              <FrameDescription>
                Como você cobra cada serviço. Vem preenchido em todo orçamento novo.
              </FrameDescription>
            </FrameHeader>
            <FramePanel>
              <PrecosServicos servicos={servicos} precos={precos} onChange={setPrecos} />
            </FramePanel>
            {rodape}
          </Frame>
        </TabsContent>
      </Tabs>
    </form>
  )
}
