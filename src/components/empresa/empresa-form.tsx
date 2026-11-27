'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2Icon, HammerIcon, HeartHandshakeIcon, ReceiptTextIcon, TagIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { mascararCnpj, mascararCpf } from '@/components/clientes/documento'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { NotaFiscalPainel } from '@/components/fiscal/nota-fiscal-painel'
import { PrecosServicos } from '@/components/orcamento/precos-servicos'
import { ServicosPicker } from '@/components/servicos/servicos-picker'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { InputGroup, InputGroupAddon, InputGroupTextarea } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CertificadoPublico, EmpresaFiscal } from '@/lib/fiscal/tipos'
import type { TabelaPrecos } from '@/lib/orcamento'
import type { Empresa } from '@/types'
import { emiteNotaFiscal } from '@/lib/assinatura'

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

export function EmpresaForm({
  empresa,
  precos: precosIniciais,
  fiscal,
  certificado,
  servidorPronto,
}: {
  empresa: Empresa
  precos: TabelaPrecos
  fiscal: EmpresaFiscal | null
  certificado: CertificadoPublico | null
  servidorPronto: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [nome, setNome] = useState(empresa.nome)
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? '')
  // Tipo de pessoa: só existe depois da migration de assinaturas.
  const tipoDisponivel = 'tipo_pessoa' in empresa
  const [tipo, setTipo] = useState<'PF' | 'PJ'>(empresa.tipo_pessoa ?? 'PJ')
  const [cpf, setCpf] = useState(empresa.cpf ?? '')
  const pf = tipo === 'PF'
  // Nota fiscal só para PJ, pelo tipo já salvo (trocar e salvar atualiza a aba).
  const emiteNota = emiteNotaFiscal(empresa.tipo_pessoa)
  const [descricao, setDescricao] = useState(empresa.descricao ?? '')
  const [modoOperacao, setModoOperacao] = useState(empresa.modo_operacao ?? '')
  const [servicos, setServicos] = useState<string[]>(empresa.servicos ?? [])
  const [precos, setPrecos] = useState<TabelaPrecos>(precosIniciais)
  // Pós-venda: só existe depois do SQL da frente D.
  const posVendaDisponivel = 'garantia_meses' in empresa
  const [garantiaMeses, setGarantiaMeses] = useState(String(empresa.garantia_meses ?? 12))
  const [linkGoogle, setLinkGoogle] = useState(empresa.link_avaliacao_google ?? '')
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const erroNome = tentou && !nome.trim() ? (pf ? 'Informe o seu nome.' : 'Informe o nome da empresa.') : null

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (!nome.trim()) return
    setSalvando(true)
    const { error } = await supabase
      .from('empresas')
      .update({
        nome,
        cnpj: pf ? null : cnpj || null,
        ...(tipoDisponivel ? { tipo_pessoa: tipo, cpf: pf ? cpf || null : null } : {}),
        descricao: descricao || null,
        modo_operacao: modoOperacao || null,
        servicos,
        ...(posVendaDisponivel
          ? {
              garantia_meses: Math.min(120, Math.max(0, Math.round(Number(garantiaMeses) || 0))),
              link_avaliacao_google: linkGoogle.trim() || null,
            }
          : {}),
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
    <div>
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
          {posVendaDisponivel && (
            <TabsTrigger value="pos-venda" className="flex-none md:flex-1">
              <HeartHandshakeIcon />
              Pós-venda
            </TabsTrigger>
          )}
          {emiteNota && (
            <TabsTrigger value="nota-fiscal" className="flex-none md:flex-1">
              <ReceiptTextIcon />
              Nota fiscal
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dados" className="min-w-0">
          <form onSubmit={salvar} noValidate>
<Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Dados da empresa</FrameTitle>
              <FrameDescription>Aparecem nos orçamentos e na sua página.</FrameDescription>
            </FrameHeader>
            <FramePanel>
              <FieldGroup>
                {tipoDisponivel && (
                  <FieldSet>
                    <FieldLegend variant="label">Tipo de conta</FieldLegend>
                    <RadioGroup
                      value={tipo}
                      onValueChange={(v) => setTipo(v as 'PF' | 'PJ')}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <FieldLabel htmlFor="empresa-tipo-pj">
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>Pessoa jurídica</FieldTitle>
                            <FieldDescription>Com CNPJ, inclusive MEI. Emite nota fiscal.</FieldDescription>
                          </FieldContent>
                          <RadioGroupItem value="PJ" id="empresa-tipo-pj" />
                        </Field>
                      </FieldLabel>
                      <FieldLabel htmlFor="empresa-tipo-pf">
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>Pessoa física</FieldTitle>
                            <FieldDescription>Autônomo, sem CNPJ. Sem nota fiscal.</FieldDescription>
                          </FieldContent>
                          <RadioGroupItem value="PF" id="empresa-tipo-pf" />
                        </Field>
                      </FieldLabel>
                    </RadioGroup>
                  </FieldSet>
                )}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={!!erroNome || undefined}>
                    <FieldLabel htmlFor="empresa-nome">{pf ? 'Nome profissional' : 'Nome da empresa'}</FieldLabel>
                    <Input
                      id="empresa-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      aria-invalid={!!erroNome || undefined}
                    />
                    <FieldError>{erroNome}</FieldError>
                  </Field>
                  {pf ? (
                    <Field>
                      <FieldLabel htmlFor="empresa-cpf">CPF</FieldLabel>
                      <Input
                        id="empresa-cpf"
                        inputMode="numeric"
                        value={cpf}
                        onChange={(e) => setCpf(mascararCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="tabular-nums"
                      />
                      <FieldDescription>Opcional.</FieldDescription>
                    </Field>
                  ) : (
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
                  )}
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
</form>
        </TabsContent>

        <TabsContent value="servicos" className="min-w-0">
          <form onSubmit={salvar} noValidate>
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
</form>
        </TabsContent>

        <TabsContent value="precos" className="min-w-0">
          <form onSubmit={salvar} noValidate>
<Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Preços dos serviços</FrameTitle>
              <FrameDescription>
                Como você cobra cada serviço. Vem preenchido em todo orçamento novo.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className={servicos.length > 0 ? 'p-0' : undefined}>
              <PrecosServicos servicos={servicos} precos={precos} onChange={setPrecos} />
            </FramePanel>
            {rodape}
          </Frame>
</form>
        </TabsContent>

        {emiteNota && (
        <TabsContent value="nota-fiscal" className="min-w-0">
          <NotaFiscalPainel
            fiscal={fiscal}
            certificado={certificado}
            servidorPronto={servidorPronto}
            empresaNome={nome}
            empresaCnpj={cnpj || null}
          />
        </TabsContent>
        )}

        {posVendaDisponivel && (
          <TabsContent value="pos-venda" className="min-w-0">
            <form onSubmit={salvar} noValidate>
<Frame spacing="default">
              <FrameHeader>
                <FrameTitle>Pós-venda</FrameTitle>
                <FrameDescription>
                  Ao concluir uma obra, criamos a garantia, a pesquisa de satisfação e o pedido de avaliação.
                </FrameDescription>
              </FrameHeader>
              <FramePanel>
                <FieldGroup>
                  <Field className="sm:max-w-48">
                    <FieldLabel htmlFor="empresa-garantia">Garantia (meses)</FieldLabel>
                    <Input
                      id="empresa-garantia"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={120}
                      value={garantiaMeses}
                      onChange={(e) => setGarantiaMeses(e.target.value)}
                      className="tabular-nums"
                    />
                    <FieldDescription>Vale para as próximas obras concluídas.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="empresa-google">Link de avaliação no Google</FieldLabel>
                    <Input
                      id="empresa-google"
                      type="url"
                      inputMode="url"
                      value={linkGoogle}
                      onChange={(e) => setLinkGoogle(e.target.value)}
                      placeholder="https://g.page/r/..."
                    />
                    <FieldDescription>
                      No Perfil da Empresa no Google, em Pedir avaliações. Vai junto na mensagem do WhatsApp.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FramePanel>
              {rodape}
            </Frame>
</form>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
