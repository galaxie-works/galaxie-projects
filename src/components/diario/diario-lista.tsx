'use client'

import { useState } from 'react'
import {
  BanIcon,
  CloudIcon,
  CloudRainIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PencilIcon,
  SunIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatarData } from '@/lib/formato'
import { removerRegistroLocal } from '@/lib/diario/local'
import { BUCKET_ARQUIVOS, CLIMA_LABEL, type Clima, type ContextoDiario, type RegistroTela } from '@/lib/diario/tipos'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmarExclusao } from '@/components/projetos/confirmar-exclusao'
import { EVENTO_LOCAL } from './use-diario'

const ICONE_CLIMA: Record<Clima, typeof SunIcon> = {
  sol: SunIcon,
  nublado: CloudIcon,
  chuva: CloudRainIcon,
  impraticavel: BanIcon,
}

function BadgeClima({ periodo, clima }: { periodo: string; clima: Clima | null }) {
  if (!clima) return null
  const Icone = ICONE_CLIMA[clima]
  return (
    <Badge variant={clima === 'impraticavel' ? 'destructive-light' : clima === 'chuva' ? 'info-light' : 'outline'}>
      <Icone />
      {periodo}: {CLIMA_LABEL[clima]}
    </Badge>
  )
}

function diaDaSemana(data: string) {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long' })
}

export function DiarioListaCarregando() {
  return (
    <ItemGroup className="gap-3">
      {[0, 1, 2].map((i) => (
        <Item key={i} variant="outline">
          <ItemContent className="gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}

type Props = {
  registros: RegistroTela[]
  contexto: ContextoDiario
  onNovo: () => void
  onEditar: (r: RegistroTela) => void
  onExcluido: () => void
}

export function DiarioLista({ registros, contexto, onNovo, onEditar, onExcluido }: Props) {
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const [excluir, setExcluir] = useState<RegistroTela | null>(null)
  const nomes = new Map(contexto.equipe.map((m) => [m.id, m.nome]))

  if (registros.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPenIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhum registro nesta obra</EmptyTitle>
          <EmptyDescription>Registre o primeiro dia de obra. Funciona sem internet.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onNovo}>Registrar o dia</Button>
        </EmptyContent>
      </Empty>
    )
  }

  async function confirmarExclusao(): Promise<boolean> {
    if (!excluir) return false
    const r = excluir
    // Sem cópia no servidor (nem foto enviada): pode sair só do aparelho.
    const soNoAparelho = !r.noServidor && r.fotos.every((f) => f.pendente)
    if (!soNoAparelho) {
      if (!navigator.onLine) {
        toast.error('Sem internet: a exclusão de um registro já enviado precisa de conexão.')
        return false
      }
      const supabase = createClient()
      // Fotos primeiro: se o Storage falhar, nada muda e dá para tentar de novo.
      const caminhos = r.fotos.map((f) => f.caminho).filter((c): c is string => Boolean(c))
      if (caminhos.length) {
        const { error: erroFotos } = await supabase.storage.from(BUCKET_ARQUIVOS).remove(caminhos)
        if (erroFotos) {
          toast.error('Não foi possível apagar as fotos', { description: erroFotos.message })
          return false
        }
      }
      const { error } = await supabase.from('diario_obra').delete().eq('id', r.id)
      if (error) {
        toast.error('Não foi possível excluir', { description: error.message })
        return false
      }
    }
    await removerRegistroLocal(r.id)
    toast.success('Registro excluído')
    window.dispatchEvent(new CustomEvent(EVENTO_LOCAL))
    onExcluido()
    return true
  }

  return (
    <>
      <ItemGroup className="gap-3">
        {registros.map((r) => {
          const presentes = r.equipe_presente.map((id) => nomes.get(id)).filter(Boolean) as string[]
          return (
            <Item key={r.id} variant="outline" className="items-start">
              <ItemHeader className="flex-wrap justify-start gap-x-2 gap-y-1">
                <ItemTitle className="first-letter:uppercase">
                  {formatarData(r.data)} · {diaDaSemana(r.data)}
                </ItemTitle>
                {r.pendente && (
                  <Badge variant={r.erro ? 'destructive-light' : 'warning-light'}>
                    {r.erro ? 'Envio com erro' : 'Aguardando envio'}
                  </Badge>
                )}
              </ItemHeader>
              <ItemContent className="min-w-0 gap-2">
                {(r.clima_manha || r.clima_tarde || presentes.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    <BadgeClima periodo="Manhã" clima={r.clima_manha} />
                    <BadgeClima periodo="Tarde" clima={r.clima_tarde} />
                    {presentes.length > 0 && (
                      <Badge variant="outline" title={presentes.join(', ')}>
                        <UsersIcon />
                        {presentes.length === 1 ? presentes[0] : `${presentes.length} na obra`}
                      </Badge>
                    )}
                  </div>
                )}
                {r.atividades && (
                  <ItemDescription className="line-clamp-none whitespace-pre-line text-foreground">
                    {r.atividades}
                  </ItemDescription>
                )}
                {r.ocorrencias && (
                  <ItemDescription className="line-clamp-none whitespace-pre-line">
                    <span className="font-medium text-foreground">Ocorrências: </span>
                    {r.ocorrencias}
                  </ItemDescription>
                )}
                {presentes.length > 1 && (
                  <ItemDescription className="text-xs">Equipe: {presentes.join(', ')}</ItemDescription>
                )}
                {r.fotos.length > 0 && (
                  <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {r.fotos.map((f) => (
                      <li key={f.id} className="aspect-square overflow-hidden rounded-md border bg-muted">
                        {f.url ? (
                          <button
                            type="button"
                            className="size-full"
                            onClick={() => setAmpliada(f.url)}
                            aria-label="Ver foto"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.url} alt="" className="size-full object-cover" loading="lazy" />
                          </button>
                        ) : (
                          <span className="flex size-full items-center justify-center p-1 text-center text-xs text-muted-foreground">
                            Com internet
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {r.erro && <ItemDescription className="text-xs text-destructive-foreground">{r.erro}</ItemDescription>}
              </ItemContent>
              <ItemActions>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações" />}>
                    <MoreHorizontalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditar(r)}>
                      <PencilIcon />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setExcluir(r)}>
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>

      <Dialog open={Boolean(ampliada)} onOpenChange={(a) => !a && setAmpliada(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="sr-only">Foto do diário</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ampliada && <img src={ampliada} alt="Foto do diário" className="max-h-[80vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>

      <ConfirmarExclusao
        aberto={Boolean(excluir)}
        onOpenChange={(a) => !a && setExcluir(null)}
        titulo="Excluir este registro?"
        descricao="O registro do dia e as fotos dele saem do diário e dos arquivos da obra."
        onConfirmar={confirmarExclusao}
      />
    </>
  )
}
