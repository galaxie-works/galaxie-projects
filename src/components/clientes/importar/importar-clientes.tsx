'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleAlertIcon, DownloadIcon, FileSpreadsheetIcon, RotateCcwIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { decodificarArquivo, gerarCsv, lerCsv } from '@/lib/csv'
import { chaveDocumento, chaveTelefone, indiceClientes, type ClienteChave } from '@/lib/duplicados'
import { useFileUpload } from '@/hooks/use-file-upload'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mascararCnpj, mascararCpf } from '../documento'
import { formatarTelefone, paraE164 } from '../telefone'
import { useClientesExistentes } from '../aviso-duplicado'

type Campo = 'nome' | 'telefone' | 'email' | 'documento' | 'razao_social' | 'endereco' | 'origem' | 'observacoes'

const CAMPOS: { campo: Campo; rotulo: string; sinonimos: string[] }[] = [
  { campo: 'nome', rotulo: 'Nome', sinonimos: ['nome', 'cliente', 'nome completo', 'nome fantasia', 'contato', 'name'] },
  { campo: 'telefone', rotulo: 'Telefone', sinonimos: ['telefone', 'celular', 'whatsapp', 'fone', 'tel', 'phone', 'contato telefone'] },
  { campo: 'email', rotulo: 'E-mail', sinonimos: ['email', 'e-mail', 'e mail', 'mail'] },
  { campo: 'documento', rotulo: 'CPF/CNPJ', sinonimos: ['cpf', 'cnpj', 'cpf/cnpj', 'cpf cnpj', 'documento', 'doc'] },
  { campo: 'razao_social', rotulo: 'Razão social', sinonimos: ['razao social', 'razão social', 'empresa'] },
  { campo: 'endereco', rotulo: 'Endereço', sinonimos: ['endereco', 'endereço', 'endereco da obra', 'endereço da obra', 'rua', 'address'] },
  { campo: 'origem', rotulo: 'Origem', sinonimos: ['origem', 'canal', 'como conheceu', 'fonte'] },
  { campo: 'observacoes', rotulo: 'Observações', sinonimos: ['observacoes', 'observações', 'obs', 'notas', 'anotacoes', 'anotações'] },
]

type Mapa = Record<Campo, number | null>

type Situacao = 'novo' | 'existe' | 'repetido' | 'sem_nome'

type Linha = {
  n: number
  nome: string
  telefone: string
  email: string
  documento: string
  tipo: 'PF' | 'PJ'
  razao_social: string
  endereco: string
  origem: string
  observacoes: string
  situacao: Situacao
  existente?: ClienteChave
  /** CPF/CNPJ com quantidade errada de dígitos: é ignorado. */
  documentoInvalido: boolean
}

const SITUACAO: Record<Situacao, { rotulo: string; variante: 'success-light' | 'warning-light' | 'secondary' | 'destructive-light' }> = {
  novo: { rotulo: 'Novo', variante: 'success-light' },
  existe: { rotulo: 'Já cadastrado', variante: 'warning-light' },
  repetido: { rotulo: 'Repetido na planilha', variante: 'secondary' },
  sem_nome: { rotulo: 'Sem nome', variante: 'destructive-light' },
}

const LIMITE_PREVIA = 100
const NENHUMA = '__nenhuma__'

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_.]/g, ' ').trim()
}

function mapaAutomatico(cabecalho: string[]): Mapa {
  const mapa = Object.fromEntries(CAMPOS.map(({ campo }) => [campo, null])) as Mapa
  const usadas = new Set<number>()
  for (const { campo, sinonimos } of CAMPOS) {
    const alvo = sinonimos.map(normalizar)
    const i = cabecalho.findIndex((c, idx) => !usadas.has(idx) && alvo.includes(normalizar(c)))
    if (i >= 0) {
      mapa[campo] = i
      usadas.add(i)
    }
  }
  return mapa
}

function baixarModelo() {
  const csv = gerarCsv([
    ['Nome', 'Telefone', 'E-mail', 'CPF/CNPJ', 'Endereço', 'Origem', 'Observações'],
    ['Mariana Albuquerque', '(11) 98765-4321', 'mariana@exemplo.com.br', '123.456.789-09', 'Rua das Acácias, 214 - São Paulo', 'Indicação', 'Quer piso na sala'],
  ])
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-clientes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportarClientes({ empresaId }: { empresaId: string }) {
  const router = useRouter()
  const existentes = useClientesExistentes(empresaId)
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [cabecalho, setCabecalho] = useState<string[]>([])
  const [dados, setDados] = useState<string[][]>([])
  const [mapa, setMapa] = useState<Mapa | null>(null)
  const [pularDuplicados, setPularDuplicados] = useState(true)
  const [origemPadrao, setOrigemPadrao] = useState('Planilha')
  const [erro, setErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  async function abrirArquivo(file: File) {
    setErro(null)
    if (file.size > 5 * 1024 * 1024) {
      setErro('A planilha passa de 5 MB. Divida em arquivos menores.')
      return
    }
    const linhas = lerCsv(decodificarArquivo(await file.arrayBuffer()))
    if (linhas.length < 2) {
      setErro('Não encontramos linhas de clientes. A primeira linha deve ter os nomes das colunas.')
      return
    }
    const [cab, ...resto] = linhas
    setArquivo(file.name)
    setCabecalho(cab)
    setDados(resto)
    setMapa(mapaAutomatico(cab))
  }

  const [{ isDragging }, upload] = useFileUpload({
    accept: '.csv,text/csv,.txt',
    onFilesAdded: (novos) => {
      const f = novos[0]?.file
      if (f instanceof File) void abrirArquivo(f)
      setTimeout(upload.clearFiles, 0)
    },
  })

  function recomecar() {
    setArquivo(null)
    setCabecalho([])
    setDados([])
    setMapa(null)
    setErro(null)
  }

  const linhas = useMemo<Linha[]>(() => {
    if (!mapa) return []
    const { porTelefone, porDocumento } = indiceClientes(existentes)
    const vistosTel = new Set<string>()
    const vistosDoc = new Set<string>()
    const valor = (l: string[], campo: Campo) => (mapa[campo] === null ? '' : (l[mapa[campo]!] ?? '').trim())

    return dados.map((l, i) => {
      const nome = valor(l, 'nome')
      const docBruto = valor(l, 'documento')
      const docDigitos = chaveDocumento(docBruto)
      const documentoInvalido = docBruto !== '' && !docDigitos
      const tipo = docDigitos.length === 14 ? 'PJ' : 'PF'
      const telefoneBruto = valor(l, 'telefone')
      const telefone = paraE164(telefoneBruto) || telefoneBruto
      const kTel = chaveTelefone(telefone)

      let situacao: Situacao = 'novo'
      let existente: ClienteChave | undefined
      if (!nome) situacao = 'sem_nome'
      else if ((kTel && porTelefone.has(kTel)) || (docDigitos && porDocumento.has(docDigitos))) {
        situacao = 'existe'
        existente = (kTel && porTelefone.get(kTel)) || porDocumento.get(docDigitos)
      } else if ((kTel && vistosTel.has(kTel)) || (docDigitos && vistosDoc.has(docDigitos))) {
        situacao = 'repetido'
      }
      if (nome) {
        if (kTel) vistosTel.add(kTel)
        if (docDigitos) vistosDoc.add(docDigitos)
      }

      return {
        n: i + 2,
        nome,
        telefone,
        email: valor(l, 'email'),
        documento: docDigitos ? (tipo === 'PJ' ? mascararCnpj(docDigitos) : mascararCpf(docDigitos)) : '',
        tipo,
        razao_social: valor(l, 'razao_social'),
        endereco: valor(l, 'endereco'),
        origem: valor(l, 'origem'),
        observacoes: valor(l, 'observacoes'),
        situacao,
        existente,
        documentoInvalido,
      }
    })
  }, [dados, mapa, existentes])

  const contagem = useMemo(() => {
    const c: Record<Situacao, number> = { novo: 0, existe: 0, repetido: 0, sem_nome: 0 }
    for (const l of linhas) c[l.situacao] += 1
    return c
  }, [linhas])

  const aImportar = linhas.filter(
    (l) => l.situacao === 'novo' || (!pularDuplicados && (l.situacao === 'existe' || l.situacao === 'repetido'))
  )

  async function importar() {
    if (aImportar.length === 0) return
    setImportando(true)
    setErro(null)
    const supabase = createClient()
    const registros = aImportar.map((l) => ({
      empresa_id: empresaId,
      tipo: l.tipo,
      nome: l.nome,
      cpf: l.tipo === 'PF' ? l.documento || null : null,
      cnpj: l.tipo === 'PJ' ? l.documento || null : null,
      razao_social: l.tipo === 'PJ' ? l.razao_social || null : null,
      email: l.email || null,
      telefone: l.telefone || null,
      endereco: l.endereco || null,
      origem: l.origem || origemPadrao.trim() || null,
      observacoes: l.observacoes || null,
    }))

    let feitos = 0
    for (let i = 0; i < registros.length; i += 200) {
      const lote = registros.slice(i, i + 200)
      let { error } = await supabase.from('clientes').insert(lote)
      // Antes do SQL do Cliente 360 não existem origem e observações.
      if (error && /origem|observacoes/.test(error.message)) {
        ;({ error } = await supabase
          .from('clientes')
          .insert(
            lote.map((r) => {
              const semCrm: Partial<typeof r> = { ...r }
              delete semCrm.origem
              delete semCrm.observacoes
              return semCrm
            })
          ))
      }
      if (error) {
        setImportando(false)
        setErro(
          `${feitos > 0 ? `${feitos} clientes entraram, mas o restante parou: ` : ''}${error.message}`
        )
        if (feitos > 0) router.refresh()
        return
      }
      feitos += lote.length
    }
    setImportando(false)
    toast.success(feitos === 1 ? '1 cliente importado' : `${feitos} clientes importados`)
    router.push('/clientes')
    router.refresh()
  }

  const itensColuna = [
    { value: NENHUMA, label: 'Não importar' },
    ...cabecalho.map((c, i) => ({ value: String(i), label: c || `Coluna ${i + 1}` })),
  ]

  if (!mapa) {
    return (
      <Frame spacing="default">
        <FramePanel className="flex flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={upload.openFileDialog}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && upload.openFileDialog()}
            onDragEnter={upload.handleDragEnter}
            onDragLeave={upload.handleDragLeave}
            onDragOver={upload.handleDragOver}
            onDrop={upload.handleDrop}
            data-dragging={isDragging || undefined}
            className={cn(
              'flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors outline-none',
              'hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-dragging:border-primary data-dragging:bg-primary/5'
            )}
          >
            <input {...upload.getInputProps()} className="sr-only" aria-label="Escolher planilha CSV" />
            <span className="flex size-10 items-center justify-center rounded-full border bg-background">
              <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Arraste a planilha aqui ou toque para escolher</p>
              <p className="text-xs text-muted-foreground">
                CSV até 5 MB. No Excel ou Google Planilhas: Arquivo › Salvar como › CSV.
              </p>
            </div>
          </div>
          {erro && (
            <Alert variant="destructive" role="alert">
              <CircleAlertIcon />
              <AlertTitle>Não foi possível ler a planilha</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
        </FramePanel>
        <FrameFooter className="flex-row flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Colunas reconhecidas: nome, telefone, e-mail, CPF/CNPJ, endereço, origem e observações.
          </span>
          <Button variant="outline" size="sm" onClick={baixarModelo}>
            <DownloadIcon data-icon="inline-start" />
            Baixar modelo
          </Button>
        </FrameFooter>
      </Frame>
    )
  }

  const previa = linhas.slice(0, LIMITE_PREVIA)

  return (
    <div className="flex flex-col gap-6">
      <Frame spacing="default">
        <FrameHeader>
          <FrameTitle>Colunas</FrameTitle>
          <FrameDescription>
            {arquivo} · {dados.length} {dados.length === 1 ? 'linha' : 'linhas'}. Confira de qual coluna vem cada dado.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CAMPOS.map(({ campo, rotulo }) => (
                <Field key={campo}>
                  <FieldLabel>
                    {rotulo}
                    {campo === 'nome' && <span className="text-destructive">*</span>}
                  </FieldLabel>
                  <Select
                    items={itensColuna}
                    value={mapa[campo] === null ? NENHUMA : String(mapa[campo])}
                    onValueChange={(v) =>
                      setMapa({ ...mapa, [campo]: v === null || v === NENHUMA ? null : Number(v) })
                    }
                  >
                    <SelectTrigger className="w-full" aria-label={`Coluna de ${rotulo}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {itensColuna.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="importar-origem">Origem quando a planilha não tiver</FieldLabel>
                <Input
                  id="importar-origem"
                  value={origemPadrao}
                  onChange={(e) => setOrigemPadrao(e.target.value)}
                  placeholder="Planilha"
                />
              </Field>
              <Field orientation="horizontal" className="items-center self-end">
                <Switch id="importar-pular" checked={pularDuplicados} onCheckedChange={setPularDuplicados} />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="importar-pular">Pular quem já está cadastrado</FieldLabel>
                  <FieldDescription>Compara telefone e CPF/CNPJ com seus clientes.</FieldDescription>
                </div>
              </Field>
            </div>
          </FieldGroup>
        </FramePanel>
      </Frame>

      <Frame spacing="default">
        <FrameHeader className="flex flex-col gap-2">
          <FrameTitle>Prévia</FrameTitle>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SITUACAO) as Situacao[])
              .filter((s) => contagem[s] > 0)
              .map((s) => (
                <Badge key={s} variant={SITUACAO[s].variante}>
                  {SITUACAO[s].rotulo}: {contagem[s]}
                </Badge>
              ))}
          </div>
        </FrameHeader>
        <FramePanel className="p-0!">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-xs max-sm:hidden">Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="max-sm:hidden">Telefone</TableHead>
                  <TableHead className="max-md:hidden">CPF/CNPJ</TableHead>
                  <TableHead className="max-lg:hidden">E-mail</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previa.map((l) => {
                  const vai =
                    l.situacao === 'novo' ||
                    (!pularDuplicados && (l.situacao === 'existe' || l.situacao === 'repetido'))
                  return (
                    <TableRow key={l.n} className={cn(!vai && 'text-muted-foreground')}>
                      <TableCell className="text-xs tabular-nums max-sm:hidden">{l.n}</TableCell>
                      <TableCell className="max-w-48 font-medium">
                        <span className="block truncate">{l.nome || '—'}</span>
                        <span className="block text-xs font-normal text-muted-foreground tabular-nums sm:hidden">
                          {formatarTelefone(l.telefone) || 'Sem telefone'}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap max-sm:hidden">
                        {formatarTelefone(l.telefone) || '—'}
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap max-md:hidden">
                        {l.documento || (l.documentoInvalido ? 'Inválido, ignorado' : '—')}
                      </TableCell>
                      <TableCell className="max-w-48 truncate max-lg:hidden">{l.email || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge variant={SITUACAO[l.situacao].variante}>{SITUACAO[l.situacao].rotulo}</Badge>
                          {l.existente && (
                            <Link
                              href={`/clientes/${l.existente.id}`}
                              className="max-w-40 truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                            >
                              {l.existente.nome}
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {linhas.length > LIMITE_PREVIA && (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Mostrando {LIMITE_PREVIA} de {linhas.length} linhas. Todas entram na importação.
            </p>
          )}
        </FramePanel>
        <FrameFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {erro ? (
            <Alert variant="destructive" role="alert" className="sm:max-w-md">
              <CircleAlertIcon />
              <AlertTitle>Importação interrompida</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          ) : (
            <span className="text-xs text-muted-foreground">
              {mapa.nome === null
                ? 'Escolha a coluna do nome para continuar.'
                : `${aImportar.length} ${aImportar.length === 1 ? 'cliente será importado' : 'clientes serão importados'}.`}
            </span>
          )}
          <div className="flex gap-2 max-sm:w-full max-sm:*:flex-1">
            <Button variant="outline" onClick={recomecar} disabled={importando}>
              <RotateCcwIcon data-icon="inline-start" />
              Outra planilha
            </Button>
            <Button onClick={importar} disabled={importando || aImportar.length === 0 || mapa.nome === null}>
              {importando ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
              {importando ? 'Importando…' : `Importar ${aImportar.length}`}
            </Button>
          </div>
        </FrameFooter>
      </Frame>
    </div>
  )
}
