'use client'

import { useState } from 'react'
import { formatarMoeda } from '@/lib/formato'
import type { Compra, Etapa, MembroEquipe, Projeto } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComprasTabela } from '@/components/projetos/compras-tabela'
import { EtapasQuadro } from '@/components/projetos/etapas-quadro'
import { ProjetoVisaoGeral } from '@/components/projetos/projeto-visao-geral'

type Props = {
  projeto: Projeto
  etapasIniciais: Etapa[]
  comprasIniciais: Compra[]
  equipe: MembroEquipe[]
  hoje: string
}

export function ProjetoAbas({ projeto, etapasIniciais, comprasIniciais, equipe, hoje }: Props) {
  // Etapas e compras ficam aqui para a Visão geral refletir as mudanças na hora.
  const [etapas, setEtapas] = useState(etapasIniciais)
  const [compras, setCompras] = useState(comprasIniciais)
  const totalGasto = compras.reduce((s, c) => s + Number(c.valor), 0)
  const concluidas = etapas.filter((e) => e.status === 'concluida').length

  return (
    <Tabs defaultValue="visao" className="gap-4">
      <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="etapas">
            Etapas
            <span className="text-xs text-muted-foreground tabular-nums">
              {concluidas}/{etapas.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="compras">
            Compras
            <span className="text-xs text-muted-foreground tabular-nums">{formatarMoeda(totalGasto)}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="visao">
        <ProjetoVisaoGeral projeto={projeto} etapas={etapas} totalGasto={totalGasto} hoje={hoje} />
      </TabsContent>
      <TabsContent value="etapas">
        <EtapasQuadro
          projetoId={projeto.id}
          etapas={etapas}
          onEtapasChange={setEtapas}
          equipe={equipe}
          hoje={hoje}
        />
      </TabsContent>
      <TabsContent value="compras">
        <ComprasTabela
          projetoId={projeto.id}
          compras={compras}
          onComprasChange={setCompras}
          equipe={equipe}
        />
      </TabsContent>
    </Tabs>
  )
}
