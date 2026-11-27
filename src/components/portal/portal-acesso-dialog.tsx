'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LinkIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  UnlinkIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { linkWhatsApp } from '@/lib/crm'
import { formatarDataHora } from '@/lib/formato'
import { linkPortal, mensagemPortal, type PortalAcesso } from '@/lib/portal'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

type Props = {
  cliente: { id: string; nome: string; telefone: string | null }
  empresaNome: string
}

// Botão "Portal do cliente" na tela do cliente: cria, copia, envia por
// WhatsApp, troca ou desativa o link que o cliente usa para acompanhar a obra.
export function PortalAcessoDialog({ cliente, empresaNome }: Props) {
  const [aberto, setAberto] = useState(false)
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="outline" />}>
        <GlobeIcon data-icon="inline-start" />
        Portal do cliente
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {aberto && <PortalAcessoConteudo cliente={cliente} empresaNome={empresaNome} />}
      </DialogContent>
    </Dialog>
  )
}

function PortalAcessoConteudo({ cliente, empresaNome }: Props) {
  const [acesso, setAcesso] = useState<PortalAcesso | null | undefined>(undefined)
  const [indisponivel, setIndisponivel] = useState(false)
  const [salvando, setSalvando] = useState<'gerar' | 'desativar' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [origem, setOrigem] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await createClient()
      .from('portal_acessos')
      .select('*')
      .eq('cliente_id', cliente.id)
      .is('revogado_em', null)
      .maybeSingle()
    if (error) {
      // Antes da migration do portal a tabela não existe.
      setIndisponivel(true)
      setAcesso(null)
      return
    }
    setAcesso((data as PortalAcesso | null) ?? null)
  }, [cliente.id])

  useEffect(() => {
    // Endereço do app (preview ou produção) e leitura inicial no Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigem(window.location.origin)
    void carregar()
  }, [carregar])

  async function gerar() {
    setSalvando('gerar')
    const { data, error } = await createClient().rpc('portal_gerar_acesso', { p_cliente_id: cliente.id })
    setSalvando(null)
    if (error) {
      toast.error('Não foi possível criar o link', { description: error.message })
      return
    }
    setAcesso(data as PortalAcesso)
    toast.success(acesso ? 'Link novo criado. O anterior parou de funcionar.' : 'Link criado')
  }

  async function desativar() {
    if (!acesso) return
    setSalvando('desativar')
    const { error } = await createClient()
      .from('portal_acessos')
      .update({ revogado_em: new Date().toISOString() })
      .eq('id', acesso.id)
    setSalvando(null)
    if (error) {
      toast.error('Não foi possível desativar o link', { description: error.message })
      return
    }
    setAcesso(null)
    toast.success('Link desativado')
  }

  const link = acesso && origem ? linkPortal(acesso.token, origem) : ''
  const whatsapp = link ? linkWhatsApp(cliente.telefone, mensagemPortal(cliente.nome, empresaNome, link)) : null

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Portal do cliente</DialogTitle>
        <DialogDescription>
          {cliente.nome} acompanha por um link: andamento, etapas, fotos e arquivos que você marcar, parcelas, notas
          fiscais e garantia. Também pode abrir chamados de assistência.
        </DialogDescription>
      </DialogHeader>

      {acesso === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : indisponivel ? (
        <Alert variant="warning">
          <AlertTitle>Portal ainda não ativado</AlertTitle>
          <AlertDescription>O banco ainda não recebeu a atualização do portal. Tente de novo em alguns minutos.</AlertDescription>
        </Alert>
      ) : !acesso ? (
        <Empty className="border py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum link ativo</EmptyTitle>
            <EmptyDescription>Crie o link e mande para o cliente. Ele não precisa de senha nem de cadastro.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={gerar} disabled={!!salvando}>
              {salvando === 'gerar' ? <Spinner data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
              Criar link
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <InputGroup>
            <InputGroupInput readOnly value={link} aria-label="Link do portal" onFocus={(e) => e.target.select()} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={copiar} aria-label="Copiar link">
                {copiado ? <CheckIcon /> : <CopyIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="success-light">Ativo</Badge>
            <span>Criado em {formatarDataHora(acesso.created_at)}</span>
            <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
            <span>
              {acesso.ultimo_acesso_em
                ? `Último acesso ${formatarDataHora(acesso.ultimo_acesso_em)} (${acesso.acessos} ${acesso.acessos === 1 ? 'visita' : 'visitas'})`
                : 'Ainda não acessado'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {whatsapp && (
              <Button nativeButton={false} render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}>
                <MessageCircleIcon data-icon="inline-start" />
                Enviar por WhatsApp
              </Button>
            )}
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={link} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              Ver como o cliente
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fotos e documentos só aparecem no portal quando você marca &quot;Mostrar no portal&quot; na aba Arquivos.
            Custos, compras e anotações internas nunca aparecem.
          </p>
        </div>
      )}

      {acesso && (
        <DialogFooter>
          <Button variant="outline" onClick={desativar} disabled={!!salvando}>
            {salvando === 'desativar' ? <Spinner data-icon="inline-start" /> : <UnlinkIcon data-icon="inline-start" />}
            Desativar
          </Button>
          <Button variant="outline" onClick={gerar} disabled={!!salvando}>
            {salvando === 'gerar' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
            Gerar novo link
          </Button>
        </DialogFooter>
      )}
    </div>
  )
}
