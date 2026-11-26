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
import { TIPO_ATIVIDADE_LABEL, type TipoAtividade } from '@/types'
import { ICONE_ATIVIDADE } from './icones-atividade'


const TIPOS: TipoAtividade[] = ['nota', 'ligacao', 'whatsapp', 'visita', 'reuniao', 'email']

type Props = {
  clienteId: string
  empresaId: string
  /** false quando a tabela de atividades ainda não existe no banco. */
  disponivel: boolean
}

// Registro rápido de contato com o cliente: tipo + texto (digitado ou falado).
export function RegistrarAtividade({ clienteId, empresaId, disponivel }: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoAtividade>('nota')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const conteudo = texto.trim()
    if (!conteudo || salvando) return
    setSalvando(true)
    const { error } = await createClient()
      .from('atividades')
      .insert({ cliente_id: clienteId, empresa_id: empresaId, tipo, texto: conteudo })
    setSalvando(false)
    if (error) {
      toast.error('Não foi possível registrar', { description: error.message })
      return
    }
    setTexto('')
    toast.success(`${TIPO_ATIVIDADE_LABEL[tipo]} registrada`)
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
      <div className="flex items-center justify-between gap-2">
        <BotaoVoz
          variant="outline"
          rotulo="Ditar o registro"
          onFinal={(falado) => setTexto((atual) => (atual ? `${atual} ${falado}` : falado))}
        />
        <Button onClick={salvar} disabled={!disponivel || salvando || !texto.trim()}>
          {salvando && <Spinner data-icon="inline-start" />}
          Registrar
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
