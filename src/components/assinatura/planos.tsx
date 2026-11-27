import { CreditCardIcon } from 'lucide-react'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// Os planos e o pagamento entram quando o gateway de cobrança for escolhido.
export function Planos() {
  return (
    <Frame spacing="default">
      <FrameHeader>
        <FrameTitle>Planos</FrameTitle>
        <FrameDescription>Escolha o plano no fim do teste; até lá tudo fica liberado.</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCardIcon />
            </EmptyMedia>
            <EmptyTitle>Assinatura online em breve</EmptyTitle>
            <EmptyDescription>
              Os planos e o pagamento por cartão, Pix ou boleto estão chegando. Seus dados
              ficam guardados e nada se perde.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </FramePanel>
    </Frame>
  )
}
