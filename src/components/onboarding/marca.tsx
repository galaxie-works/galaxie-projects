import { IconTile } from '@/components/reui/icon-tile'

// Marca do app (login, cadastro e onboarding).
export function Marca() {
  return (
    <div className="flex items-center gap-2">
      <IconTile variant="solid" size="sm" aria-hidden="true">
        <span className="text-sm font-semibold">G</span>
      </IconTile>
      <span className="text-sm font-semibold tracking-tight">Galaxie Obras</span>
    </div>
  )
}
