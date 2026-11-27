'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlertIcon, FileKey2Icon, ShieldCheckIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatBytes, useFileUpload } from '@/hooks/use-file-upload'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { enviarCertificado, removerCertificado, salvarDadosFiscais } from '@/lib/fiscal/acoes'
import type { CertificadoPublico, EmpresaFiscal } from '@/lib/fiscal/tipos'
import { buscarCep, mascararCep, mascararDocumento, OpcaoSelect } from './campos'

const OPCOES_SIMPLES = [
  { value: '3', label: 'Simples Nacional (ME/EPP)' },
  { value: '2', label: 'MEI' },
  { value: '1', label: 'Não optante (Lucro Presumido ou Real)' },
]

const OPCOES_APURACAO = [
  { value: '1', label: 'Federais e ISS pelo Simples' },
  { value: '2', label: 'Federais pelo Simples, ISS por fora' },
  { value: '3', label: 'Federais e ISS por fora do Simples' },
]

const OPCOES_REGIME_ESPECIAL = [
  { value: '0', label: 'Nenhum' },
  { value: '3', label: 'Microempresa municipal' },
  { value: '2', label: 'Estimativa' },
  { value: '5', label: 'Profissional autônomo' },
  { value: '6', label: 'Sociedade de profissionais' },
  { value: '1', label: 'Ato cooperado' },
  { value: '9', label: 'Outros' },
]

const VAZIO: Omit<EmpresaFiscal, 'empresa_id'> = {
  razao_social: '',
  cnpj: '',
  inscricao_municipal: '',
  opcao_simples: '3',
  regime_apuracao_simples: '1',
  regime_especial: '0',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  codigo_municipio: '',
  telefone: '',
  email: '',
  codigo_tributacao_nacional: '070201',
  codigo_tributacao_municipal: '',
  codigo_nbs: '',
  aliquota_iss: null,
  iss_retido: false,
  percentual_tributos_simples: null,
  descricao_padrao: '',
  ibscbs_ind_op: '',
  ibscbs_cst: '000',
  ibscbs_class_trib: '000001',
  ibscbs_sempre: false,
  ambiente: 'homologacao',
  serie: '1',
  proximo_numero_homologacao: 1,
  proximo_numero_producao: 1,
}

function dataBr(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

function CertificadoFrame({
  certificado,
  servidorPronto,
}: {
  certificado: CertificadoPublico | null
  servidorPronto: boolean
}) {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [enviando, iniciar] = useTransition()
  const [
    { files, isDragging, errors },
    { clearFiles, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({ maxFiles: 1, maxSize: 64 * 1024, accept: '.pfx,.p12,application/x-pkcs12', multiple: false })
  const arquivo = files[0]?.file instanceof File ? (files[0].file as File) : null

  const [agora] = useState(() => Date.now())
  const diasParaVencer = certificado?.valido_ate
    ? Math.ceil((new Date(certificado.valido_ate).getTime() - agora) / 86_400_000)
    : null

  function enviar() {
    if (!arquivo) return
    const form = new FormData()
    form.set('arquivo', arquivo)
    form.set('senha', senha)
    iniciar(async () => {
      const r = await enviarCertificado(form)
      if (!r.ok) {
        toast.error(r.erro)
        return
      }
      toast.success('Certificado guardado com segurança.')
      setSenha('')
      clearFiles()
      router.refresh()
    })
  }

  function remover() {
    iniciar(async () => {
      const r = await removerCertificado()
      if (!r.ok) toast.error(r.erro)
      else {
        toast.success('Certificado removido.')
        router.refresh()
      }
    })
  }

  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>Certificado digital A1</FrameTitle>
        <FrameDescription>
          É ele que assina a nota. O arquivo e a senha ficam cifrados e só são usados no servidor.
        </FrameDescription>
      </FrameHeader>
      <FramePanel>
        <FieldGroup>
          {!servidorPronto && (
            <Alert variant="warning">
              <CircleAlertIcon />
              <AlertTitle>Servidor sem chave mestra</AlertTitle>
              <AlertDescription>Configure IA_CHAVE_MESTRA na Vercel para guardar o certificado.</AlertDescription>
            </Alert>
          )}
          {certificado && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ShieldCheckIcon className="text-success size-5 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{certificado.titular ?? 'Certificado enviado'}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {certificado.documento ? mascararDocumento(certificado.documento) + ' · ' : ''}
                    vence em {dataBr(certificado.valido_ate)}
                  </span>
                </div>
                {diasParaVencer !== null && diasParaVencer <= 30 && (
                  <Badge variant={diasParaVencer <= 0 ? 'destructive-light' : 'warning-light'}>
                    {diasParaVencer <= 0 ? 'Vencido' : `Vence em ${diasParaVencer} dias`}
                  </Badge>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={remover} disabled={enviando}>
                <Trash2Icon data-icon="inline-start" />
                Remover
              </Button>
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={openFileDialog}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openFileDialog()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            data-dragging={isDragging || undefined}
            className="border-input hover:bg-accent/50 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors"
          >
            <input {...getInputProps()} className="sr-only" aria-label="Arquivo do certificado" />
            {arquivo ? (
              <>
                <FileKey2Icon className="text-muted-foreground size-5" />
                <span className="text-sm font-medium">{arquivo.name}</span>
                <span className="text-muted-foreground text-xs">{formatBytes(arquivo.size)}</span>
              </>
            ) : (
              <>
                <UploadIcon className="text-muted-foreground size-5" />
                <span className="text-sm font-medium">
                  {certificado ? 'Trocar o certificado' : 'Escolha o arquivo .pfx ou .p12'}
                </span>
                <span className="text-muted-foreground text-xs">Arraste aqui ou toque para escolher</span>
              </>
            )}
          </div>
          {errors.length > 0 && <p className="text-destructive text-xs">Use o arquivo .pfx ou .p12 do certificado A1.</p>}

          {arquivo && (
            <Field className="sm:max-w-xs">
              <FieldLabel htmlFor="cert-senha">Senha do certificado</FieldLabel>
              <Input
                id="cert-senha"
                type="password"
                autoComplete="off"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
          )}
        </FieldGroup>
      </FramePanel>
      {arquivo && (
        <FrameFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => clearFiles()} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" onClick={enviar} disabled={enviando || !senha || !servidorPronto}>
            {enviando && <Spinner data-icon="inline-start" />}
            Guardar certificado
          </Button>
        </FrameFooter>
      )}
    </Frame>
  )
}

export function NotaFiscalPainel({
  fiscal,
  certificado,
  servidorPronto,
  empresaNome,
  empresaCnpj,
}: {
  fiscal: EmpresaFiscal | null
  certificado: CertificadoPublico | null
  servidorPronto: boolean
  empresaNome: string
  empresaCnpj: string | null
}) {
  const router = useRouter()
  const [f, setF] = useState(() => ({
    ...VAZIO,
    razao_social: empresaNome,
    cnpj: empresaCnpj ?? '',
    ...Object.fromEntries(Object.entries(fiscal ?? {}).filter(([, v]) => v !== null)),
  }))
  const [salvando, iniciar] = useTransition()
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((a) => ({ ...a, [k]: v }))

  async function aoMudarCep(valor: string) {
    set('cep', mascararCep(valor))
    const e = await buscarCep(valor)
    if (!e) return
    setF((a) => ({
      ...a,
      logradouro: a.logradouro || e.logradouro,
      bairro: a.bairro || e.bairro,
      cidade: e.cidade,
      uf: e.uf,
      codigo_municipio: e.codigoMunicipio,
    }))
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    iniciar(async () => {
      const r = await salvarDadosFiscais({
        ...f,
        aliquota_iss: f.aliquota_iss === null || String(f.aliquota_iss) === '' ? null : Number(f.aliquota_iss),
        percentual_tributos_simples:
          f.percentual_tributos_simples === null || String(f.percentual_tributos_simples) === ''
            ? null
            : Number(f.percentual_tributos_simples),
      })
      if (!r.ok) toast.error(r.erro)
      else {
        toast.success('Dados fiscais salvos.')
        router.refresh()
      }
    })
  }

  const producao = f.ambiente === 'producao'

  return (
    <div className="flex flex-col gap-6">
      <CertificadoFrame certificado={certificado} servidorPronto={servidorPronto} />

      <form onSubmit={salvar} noValidate>
        <Frame spacing="default">
          <FrameHeader>
            <FrameTitle>Dados fiscais</FrameTitle>
            <FrameDescription>
              A nota sai pelo emissor nacional da NFS-e (gov.br), sem custo por nota.
            </FrameDescription>
          </FrameHeader>
          <FramePanel>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="nf-razao">Razão social</FieldLabel>
                  <Input id="nf-razao" value={f.razao_social ?? ''} onChange={(e) => set('razao_social', e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="nf-cnpj">CNPJ</FieldLabel>
                  <Input
                    id="nf-cnpj"
                    inputMode="numeric"
                    className="tabular-nums"
                    value={mascararDocumento(f.cnpj ?? '')}
                    onChange={(e) => set('cnpj', e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="nf-im">Inscrição municipal</FieldLabel>
                  <Input
                    id="nf-im"
                    value={f.inscricao_municipal ?? ''}
                    onChange={(e) => set('inscricao_municipal', e.target.value)}
                  />
                  <FieldDescription>Só se a sua prefeitura pedir.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="nf-simples">Regime</FieldLabel>
                  <OpcaoSelect
                    id="nf-simples"
                    valor={f.opcao_simples}
                    opcoes={OPCOES_SIMPLES}
                    onChange={(v) => set('opcao_simples', v as EmpresaFiscal['opcao_simples'])}
                  />
                </Field>
                {f.opcao_simples === '3' && (
                  <Field>
                    <FieldLabel htmlFor="nf-apuracao">Apuração no Simples</FieldLabel>
                    <OpcaoSelect
                      id="nf-apuracao"
                      valor={f.regime_apuracao_simples ?? '1'}
                      opcoes={OPCOES_APURACAO}
                      onChange={(v) => set('regime_apuracao_simples', v as EmpresaFiscal['regime_apuracao_simples'])}
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="nf-especial">Regime especial</FieldLabel>
                  <OpcaoSelect
                    id="nf-especial"
                    valor={f.regime_especial}
                    opcoes={OPCOES_REGIME_ESPECIAL}
                    onChange={(v) => set('regime_especial', v)}
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-6">
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="nf-cep">CEP</FieldLabel>
                  <Input
                    id="nf-cep"
                    inputMode="numeric"
                    className="tabular-nums"
                    value={mascararCep(f.cep ?? '')}
                    onChange={(e) => aoMudarCep(e.target.value)}
                  />
                </Field>
                <Field className="sm:col-span-4">
                  <FieldLabel htmlFor="nf-cidade">Município</FieldLabel>
                  <Input
                    id="nf-cidade"
                    readOnly
                    value={f.cidade ? `${f.cidade}/${f.uf} · IBGE ${f.codigo_municipio}` : ''}
                    placeholder="Preenchido pelo CEP"
                  />
                </Field>
                <Field className="sm:col-span-4">
                  <FieldLabel htmlFor="nf-rua">Endereço</FieldLabel>
                  <Input id="nf-rua" value={f.logradouro ?? ''} onChange={(e) => set('logradouro', e.target.value)} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="nf-numero">Número</FieldLabel>
                  <Input id="nf-numero" value={f.numero ?? ''} onChange={(e) => set('numero', e.target.value)} />
                </Field>
                <Field className="sm:col-span-3">
                  <FieldLabel htmlFor="nf-bairro">Bairro</FieldLabel>
                  <Input id="nf-bairro" value={f.bairro ?? ''} onChange={(e) => set('bairro', e.target.value)} />
                </Field>
                <Field className="sm:col-span-3">
                  <FieldLabel htmlFor="nf-email">E-mail fiscal</FieldLabel>
                  <Input id="nf-email" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
                </Field>
              </div>
            </FieldGroup>
          </FramePanel>
          <FramePanel>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="nf-ctrib">Código de tributação nacional</FieldLabel>
                  <Input
                    id="nf-ctrib"
                    inputMode="numeric"
                    className="tabular-nums"
                    maxLength={6}
                    value={f.codigo_tributacao_nacional}
                    onChange={(e) => set('codigo_tributacao_nacional', e.target.value.replace(/\D/g, ''))}
                  />
                  <FieldDescription>070201 = obras de construção civil.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="nf-ctribmun">Código municipal</FieldLabel>
                  <Input
                    id="nf-ctribmun"
                    inputMode="numeric"
                    className="tabular-nums"
                    maxLength={3}
                    value={f.codigo_tributacao_municipal ?? ''}
                    onChange={(e) => set('codigo_tributacao_municipal', e.target.value.replace(/\D/g, ''))}
                  />
                  <FieldDescription>Opcional, 3 dígitos.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="nf-aliq">Alíquota do ISS (%)</FieldLabel>
                  <Input
                    id="nf-aliq"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={f.aliquota_iss ?? ''}
                    onChange={(e) => set('aliquota_iss', e.target.value.replace(',', '.') as unknown as number)}
                  />
                  <FieldDescription>Deixe vazio para usar a da prefeitura.</FieldDescription>
                </Field>
                {f.opcao_simples === '3' && (
                  <Field>
                    <FieldLabel htmlFor="nf-pctsn">Tributos do Simples (%)</FieldLabel>
                    <Input
                      id="nf-pctsn"
                      inputMode="decimal"
                      className="tabular-nums"
                      value={f.percentual_tributos_simples ?? ''}
                      onChange={(e) =>
                        set('percentual_tributos_simples', e.target.value.replace(',', '.') as unknown as number)
                      }
                    />
                    <FieldDescription>Alíquota efetiva do DAS. Opcional.</FieldDescription>
                  </Field>
                )}
              </div>
              <Field orientation="horizontal">
                <Switch id="nf-retido" checked={f.iss_retido} onCheckedChange={(v) => set('iss_retido', !!v)} />
                <FieldLabel htmlFor="nf-retido">O cliente retém o ISS</FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="nf-desc">Descrição padrão do serviço</FieldLabel>
                <Textarea
                  id="nf-desc"
                  rows={3}
                  value={f.descricao_padrao ?? ''}
                  onChange={(e) => set('descricao_padrao', e.target.value)}
                  placeholder="Serviço de assentamento de pisos e revestimentos, com mão de obra."
                />
              </Field>
            </FieldGroup>
          </FramePanel>
          <FramePanel>
            <FieldGroup>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Reforma tributária (IBS/CBS)</span>
                <span className="text-muted-foreground text-xs">
                  {f.opcao_simples === '1'
                    ? 'Obrigatório para quem não é do Simples desde 01/10/2026. Confirme os códigos com o seu contador.'
                    : 'No Simples e no MEI ainda é opcional. Ligue só se o seu contador pedir.'}
                </span>
              </div>
              {f.opcao_simples !== '1' && (
                <Field orientation="horizontal">
                  <Switch
                    id="nf-ibscbs-sempre"
                    checked={f.ibscbs_sempre}
                    onCheckedChange={(v) => set('ibscbs_sempre', !!v)}
                  />
                  <FieldLabel htmlFor="nf-ibscbs-sempre">Informar IBS/CBS nas notas</FieldLabel>
                </Field>
              )}
              {(f.opcao_simples === '1' || f.ibscbs_sempre) && (
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="nf-cindop">Indicador da operação</FieldLabel>
                    <Input
                      id="nf-cindop"
                      inputMode="numeric"
                      className="tabular-nums"
                      maxLength={6}
                      value={f.ibscbs_ind_op ?? ''}
                      onChange={(e) => set('ibscbs_ind_op', e.target.value.replace(/\D/g, ''))}
                    />
                    <FieldDescription>cIndOp, 6 dígitos.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="nf-cst">CST IBS/CBS</FieldLabel>
                    <Input
                      id="nf-cst"
                      inputMode="numeric"
                      className="tabular-nums"
                      maxLength={3}
                      value={f.ibscbs_cst}
                      onChange={(e) => set('ibscbs_cst', e.target.value.replace(/\D/g, ''))}
                    />
                    <FieldDescription>000 = tributação integral.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="nf-classtrib">Classificação tributária</FieldLabel>
                    <Input
                      id="nf-classtrib"
                      inputMode="numeric"
                      className="tabular-nums"
                      maxLength={6}
                      value={f.ibscbs_class_trib}
                      onChange={(e) => set('ibscbs_class_trib', e.target.value.replace(/\D/g, ''))}
                    />
                    <FieldDescription>cClassTrib, 6 dígitos.</FieldDescription>
                  </Field>
                </div>
              )}
            </FieldGroup>
          </FramePanel>
          <FramePanel>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="nf-serie">Série</FieldLabel>
                  <Input
                    id="nf-serie"
                    inputMode="numeric"
                    className="tabular-nums"
                    maxLength={5}
                    value={f.serie}
                    onChange={(e) => set('serie', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Próxima nota</FieldLabel>
                  <p className="text-sm tabular-nums">
                    nº {producao ? f.proximo_numero_producao : f.proximo_numero_homologacao}
                  </p>
                </Field>
              </div>
              <Field orientation="horizontal">
                <Switch
                  id="nf-producao"
                  checked={producao}
                  onCheckedChange={(v) => set('ambiente', v ? 'producao' : 'homologacao')}
                />
                <FieldLabel htmlFor="nf-producao">Emitir notas de verdade (produção)</FieldLabel>
              </Field>
              {!producao ? (
                <Alert variant="info">
                  <CircleAlertIcon />
                  <AlertTitle>Modo teste</AlertTitle>
                  <AlertDescription>
                    As notas vão para a produção restrita do gov.br e não têm valor fiscal. Use para conferir tudo
                    antes de ligar a produção.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="warning">
                  <CircleAlertIcon />
                  <AlertTitle>Produção ligada</AlertTitle>
                  <AlertDescription>As próximas notas têm valor fiscal e vão para a prefeitura.</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </FramePanel>
          <FrameFooter className="flex-row justify-end">
            <Button type="submit" disabled={salvando}>
              {salvando && <Spinner data-icon="inline-start" />}
              {salvando ? 'Salvando…' : 'Salvar dados fiscais'}
            </Button>
          </FrameFooter>
        </Frame>
      </form>
    </div>
  )
}
