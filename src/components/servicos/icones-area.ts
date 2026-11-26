import {
  ArmchairIcon,
  HardHatIcon,
  PlugZapIcon,
  TreesIcon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react'

// Ícone de cada área de AREAS_SERVICO (pelo id). Área nova sem ícone cai no
// capacete, que é o símbolo genérico de obra.
const ICONES: Record<string, LucideIcon> = {
  'construcao-reforma': HardHatIcon,
  instalacoes: PlugZapIcon,
  'marcenaria-interiores': ArmchairIcon,
  'area-externa': TreesIcon,
  manutencao: WrenchIcon,
}

export function iconeDaArea(areaId: string): LucideIcon {
  return ICONES[areaId] ?? HardHatIcon
}
