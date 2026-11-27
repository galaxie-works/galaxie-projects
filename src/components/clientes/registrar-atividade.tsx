'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { BotaoVoz } from '@/components/voz/botao-voz'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  CamposProximoPasso,
  linhaProximoPasso,
  proximoPassoVazio,
  type ProximoPasso,
} from '@/components/agenda/campos-proximo-passo'
import { diaValido, montarPrevisto, rotuloDia } from '@/lib/agenda'
import { TIPO_ATIVIDADE_LABEL, type MembroEquipe, type TipoAtividade } from '@/types'
import { ICONE_ATIVIDADE } from './icones-atividade'


const TIPOS: TipoAtividade[] = ['nota', 'ligacao', 'whatsapp', 'visita', 'reuniao', 'email']

type Props = {
  clienteId: string
  empresaId: string
  /** false quando a tabela de atividades ainda não existe no banco. */
  disponivel: boolean
  /** false quando as colunas da agenda (previsto_para etc.) ainda não existem. */
  agendaDisponivel: boolean
  equipe: Pick<MembroEquipe, 'id' | 'nome'>[]
  responsavelPadrao: string | null
  hoje: string
}

// Registro rápido de contato com o cliente: tipo + texto (digitado ou falado),
// e, opcionalmente, o próximo passo já agendado.
export function RegistrarAtividade({
  clienteId,
  empresaId,
  disponivel,
  agendaDisponivel,
  equipe,
  responsavelPadrao,
  hoje,
}: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoAtividade>('nota')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [agendar, setAgendar] = useState(false)
  const [passo, setPasso] = useState<ProximoPasso>(() => proximoPassoVazio(hoje, responsavelPadrao))

  const conteudo = texto.trim()
  const podeSalvar =
    disponivel && !salvando && (Boolean(conteudo) || agendar) && (!agendar || diaValido(passo.dia))

  async function salvar() {
    if (!podeSalvar) return
    const linhas: Record<string, unknown>[] = []
    if (conteudo) linhas.push({ cliente_id: clienteId, empresa_id: empresaId, tipo, texto: conteudo })
    if (agendar) linhas.push(linhaProximoPasso(passo, { clienteId, empresaId }, montarPrevisto))
    setSalvando(true)
    const { error } = await createClient().from('atividades').insert(linhas)
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível registrar', { description: error.message })
      return
    }
    setTexto('')
    if (agendar) {
      toast.success(conteudo ? 'Contato registrado e próximo passo agendado' : 'Próximo passo agendado', {
        description: `${TIPO_ATIVIDADE_LABEL[passo.tipo]} em ${rotuloDia(passo.dia)} às ${passo.hora}`,
      })
      setAgendar(false)
      setPasso(proximoPassoVazio(hoje, responsavelPadrao))
    } else {
      toast.success('Contato registrado', { description: TIPO_ATIVIDADE_LABEL[tipo] })
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        variant="outline"
        size="sm"
        value={[tipo]}
        onValueChange={(valor) => {
          const proximo = valor[0] as TipoAtividade | undefined
          if (proximo) setTipo(proximo)
        }}
        aria-label="Tipo de contato"
        className="flex-wrap"
      >
        {TIPOS.map((t) => {
          const Icone = ICONE_ATIVIDADE[t]
          return (
            <ToggleGroupItem key={t} value={t}>
              <Icone />
              {TIPO_ATIVIDADE_LABEL[t]}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <Field>
        <FieldLabel htmlFor="atividade-texto" className="sr-only">
          O que aconteceu
        </FieldLabel>
        <Textarea
          id="atividade-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="O que aconteceu? Ex.: liguei, pediu desconto no rodapé, retornar sexta"
          rows={3}
          disabled={!disponivel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) salvar()
          }}
        />
      </Field>
      {agendaDisponivel && (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed p-3">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            Agendar próximo passo
            <Switch checked={agendar} onCheckedChange={setAgendar} disabled={!disponivel} />
          </label>
          {agendar && (
            <CamposProximoPasso
              idBase="proximo-passo"
              valor={passo}
              onChange={setPasso}
              equipe={equipe}
              hoje={hoje}
              disabled={!disponivel}
            />
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <BotaoVoz
          variant="outline"
          rotulo="Ditar o registro"
          onFinal={(falado) => setTexto((atual) => (atual ? `${atual} ${falado}` : falado))}
        />
        <Button onClick={salvar} disabled={!podeSalvar}>
          {salvando && <Spinner data-icon="inline-start" />}
          {agendar && !conteudo ? 'Agendar' : 'Registrar'}
        </Button>
      </div>
      {!disponivel && (
        <p className="text-xs text-muted-foreground">
          Para registrar contatos, rode o SQL do Cliente 360 no Supabase.
        </p>
      )}
    </div>
  )
}
