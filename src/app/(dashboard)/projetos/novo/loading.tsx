import { Frame, FrameHeader, FramePanel } from '@/components/reui/frame'
import { Skeleton } from '@/components/ui/skeleton'

export default function CarregandoNovoProjeto() {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      role="status"
      aria-label="Carregando formulário"
    >
      <Frame spacing="default">
        <FrameHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </FramePanel>
      </Frame>
    </div>
  )
}
