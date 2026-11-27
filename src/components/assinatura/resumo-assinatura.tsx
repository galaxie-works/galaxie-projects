import { FileTextIcon, SparklesIcon } from 'lucide-react'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Progress } from '@/components/ui/progress'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import {
  ROTULO_STATUS,
  emiteNotaFiscal,
  textoDiasRestantes,
  type Situacao,
  type TipoPessoa,
} from '@/lib/assinatura'

const dataLonga = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const VARIANTE_STATUS = {
  teste: 'primary-light',
  ativa: 'success-light',
  cortesia: 'success-light',
  atrasada: 'warning-light',
  cancelada: 'destructive-light',
} as const

/** Situação da assinatura e do tipo de conta (usado em /assinatura e no bloqueio). */
export function ResumoAssinatura({
  situacao,
  tipo,
}: {
  situacao: Situacao
  tipo: TipoPessoa
}) {
  const { status, fim, diasRestantes, progressoTeste, liberado } = situacao
  const emite = emiteNotaFiscal(tipo)

  let detalhe: string
  if (!liberado) detalhe = fim ? `Encerrou em ${dataLonga(fim)}.` : 'Encerrada.'
  else if (status === 'cortesia') detalhe = 'Acesso liberado, sem data de fim.'
  else if (status === 'teste' && fim) detalhe = `Grátis até ${dataLonga(fim)}. Sem cartão.`
  else if (fim) detalhe = `Vale até ${dataLonga(fim)}.`
  else detalhe = 'Renova automaticamente.'

  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>Sua assinatura</FrameTitle>
        <FrameDescription>A conta é da empresa: todo mundo da equipe usa o mesmo plano.</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <ItemGroup className="gap-3">
          <Item variant="outline">
            <ItemMedia variant="icon">
              <SparklesIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {liberado ? ROTULO_STATUS[status] : 'Teste encerrado'}
                <Badge variant={liberado ? VARIANTE_STATUS[status] : 'destructive-light'}>
                  {liberado && diasRestantes !== null
                    ? textoDiasRestantes(diasRestantes)
                    : liberado
                      ? 'Liberada'
                      : 'Bloqueada'}
                </Badge>
              </ItemTitle>
              <ItemDescription>{detalhe}</ItemDescription>
              {status === 'teste' && liberado && progressoTeste !== null && (
                <Progress
                  value={progressoTeste}
                  aria-label="Quanto do teste grátis já passou"
                  className="mt-2"
                />
              )}
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemMedia variant="icon">
              <FileTextIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}
                <Badge variant={emite ? 'success-light' : 'secondary'}>
                  {emite ? 'Emite nota fiscal' : 'Sem nota fiscal'}
                </Badge>
              </ItemTitle>
              <ItemDescription>
                {emite
                  ? 'A NFS-e é configurada em Empresa, na aba Nota fiscal.'
                  : 'Pessoa física não emite nota pelo app. Se abrir CNPJ, troque em Empresa.'}
              </ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
      </FramePanel>
    </Frame>
  )
}
