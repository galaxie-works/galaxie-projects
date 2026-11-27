'use client'

import { BuildingIcon, KeyRoundIcon, LayersIcon, SparklesIcon, TicketPercentIcon } from 'lucide-react'
import { Badge } from '@/components/reui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ConfigPlataforma, PlanoPainel } from '@/lib/plataforma/config'
import type { SituacaoSegredo } from '@/lib/plataforma/segredos'
import { Assinantes } from './assinantes'
import { Chaves } from './chaves'
import { Cupons } from './cupons'
import { Extras } from './extras'
import { PlanosAdmin } from './planos-admin'

export interface Cupom {
  id: string
  codigo: string
  ativo: boolean
  percentual: number | null
  valor: number | null
  duracao: 'once' | 'repeating' | 'forever'
  meses: number | null
  usos: number
  maxUsos: number | null
  expiraEm: string | null
}

export interface Assinante {
  id: string
  nome: string
  email: string
  tipo: 'PF' | 'PJ'
  criadaEm: string
  status: string | null
  plano: string | null
  ciclo: string | null
  testeFim: string | null
  periodoFim: string | null
  pagaStripe: boolean
  comandos: number | null
  cota: number | null
}

type Props = {
  segredos: SituacaoSegredo[]
  planos: PlanoPainel[]
  config: ConfigPlataforma
  cupons: Cupom[]
  erroCupons: string | null
  assinantes: Assinante[] | null
  stripeLigado: boolean
  stripeModo: 'producao' | 'teste' | null
  servidorPronto: { serviceRole: boolean; chaveMestra: boolean }
}

export function PainelAdmin(p: Props) {
  const faltam = p.segredos.filter((s) => !s.origem).length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Stripe:</span>
        {p.stripeModo === 'producao' ? (
          <Badge variant="success-light">Ligado, produção</Badge>
        ) : p.stripeModo === 'teste' ? (
          <Badge variant="warning-light">Ligado, modo teste</Badge>
        ) : (
          <Badge variant="destructive-light">Desligado</Badge>
        )}
        <span className="text-muted-foreground ml-2">IA da Galaxie:</span>
        {p.segredos.find((s) => s.nome === 'ANTHROPIC_API_KEY')?.origem ? (
          <Badge variant="success-light">Ligada</Badge>
        ) : (
          <Badge variant="destructive-light">Desligada</Badge>
        )}
      </div>
      <Tabs defaultValue={faltam ? 'chaves' : 'planos'}>
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="chaves">
            <KeyRoundIcon />
            Chaves
            {faltam > 0 && <Badge variant="warning-light">{faltam}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="planos">
            <LayersIcon />
            Planos
          </TabsTrigger>
          <TabsTrigger value="cupons">
            <TicketPercentIcon />
            Cupons
          </TabsTrigger>
          <TabsTrigger value="extras">
            <SparklesIcon />
            IA e extras
          </TabsTrigger>
          <TabsTrigger value="assinantes">
            <BuildingIcon />
            Assinantes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chaves" className="pt-2">
          <Chaves segredos={p.segredos} stripeLigado={p.stripeLigado} servidorPronto={p.servidorPronto} />
        </TabsContent>
        <TabsContent value="planos" className="pt-2">
          <PlanosAdmin planos={p.planos} stripeLigado={p.stripeLigado} />
        </TabsContent>
        <TabsContent value="cupons" className="pt-2">
          <Cupons cupons={p.cupons} erro={p.erroCupons} stripeLigado={p.stripeLigado} />
        </TabsContent>
        <TabsContent value="extras" className="pt-2">
          <Extras config={p.config} />
        </TabsContent>
        <TabsContent value="assinantes" className="pt-2">
          <Assinantes assinantes={p.assinantes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
