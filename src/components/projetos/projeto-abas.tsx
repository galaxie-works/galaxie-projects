'use client'

import { useState } from 'react'
import { formatarMoeda } from '@/lib/formato'
import type { Cliente, Compra, Etapa, MembroEquipe, PosVenda, Projeto, Recebimento } from '@/types'
import { resumoRecebimentos } from '@/lib/financeiro'
import { FinanceiroObra } from '@/components/financeiro/financeiro-obra'
import { pendentesPosVenda } from '@/lib/pos-venda'
import { PosVendaPainel } from '@/components/pos-venda/pos-venda-painel'
import { totalOrcamento, type AreaOrcamento, type TabelaPrecos } from '@/lib/orcamento'
import { OrcamentoAba } from '@/components/orcamento/orcamento-aba'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComprasTabela } from '@/components/projetos/compras-tabela'
import { EtapasQuadro } from '@/components/projetos/etapas-quadro'
import { ProjetoVisaoGeral } from '@/components/projetos/projeto-visao-geral'
import { ArquivosLista } from '@/components/arquivos/arquivos-lista'
import { Frame, FramePanel } from '@/components/reui/frame'

type Props = {
  projeto: Projeto
  etapasIniciais: Etapa[]
  comprasIniciais: Compra[]
  equipe: MembroEquipe[]
  hoje: string
  areasIniciais: AreaOrcamento[]
  servicosEmpresa: string[]
  precos: TabelaPrecos
  recebimentosIniciais: Recebimento[]
  /** false antes de rodar o SQL do financeiro. */
  financeiroDisponivel: boolean
  /** Quem está logado pode ver valores recebidos (ver podeVerFinanceiro). */
  verFinanceiro: boolean
  posVenda: PosVenda[]
  posVendaDisponivel: boolean
  cliente: Cliente | null
  linkGoogle: string | null
  /** 'YYYY-MM-DD' no fuso de Brasília. */
  hojeBrasil: string
  /** Aba aberta ao chegar (ex.: ?aba=orcamento vindo do funil). */
  abaInicial?: string
}

export function ProjetoAbas({
  projeto,
  etapasIniciais,
  comprasIniciais,
  equipe,
  hoje,
  areasIniciais,
  servicosEmpresa,
  precos,
  recebimentosIniciais,
  financeiroDisponivel,
  verFinanceiro,
  posVenda,
  posVendaDisponivel,
  cliente,
  linkGoogle,
  hojeBrasil,
  abaInicial,
}: Props) {
  const pendentesPv = pendentesPosVenda(posVenda)
  // Etapas e compras ficam aqui para a Visão geral refletir as mudanças na hora.
  const [etapas, setEtapas] = useState(etapasIniciais)
  const [compras, setCompras] = useState(comprasIniciais)
  const [areas, setAreas] = useState(areasIniciais)
  const [recebimentos, setRecebimentos] = useState(recebimentosIniciais)
  const financeiro = resumoRecebimentos(recebimentos, hoje)
  const totalGasto = compras.reduce((s, c) => s + Number(c.valor), 0)
  const concluidas = etapas.filter((e) => e.status === 'concluida').length

  return (
    <Tabs defaultValue={abaInicial ?? 'visao'} className="gap-4">
      <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="orcamento">
            Orçamento
            {areas.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatarMoeda(totalOrcamento(areas))}
              </span>
            )}
          </TabsTrigger>
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
          {verFinanceiro && (
            <TabsTrigger value="financeiro">
              Financeiro
              {recebimentos.length > 0 && (
                <span
                  className={`text-xs tabular-nums ${financeiro.atrasado > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {formatarMoeda(financeiro.recebido)}
                </span>
              )}
            </TabsTrigger>
          )}
          {(projeto.status === 'completo' || posVenda.length > 0) && (
            <TabsTrigger value="pos-venda">
              Pós-venda
              {pendentesPv > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{pendentesPv}</span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="visao">
        <ProjetoVisaoGeral projeto={projeto} etapas={etapas} totalGasto={totalGasto} hoje={hoje} />
      </TabsContent>
      <TabsContent value="orcamento">
        <OrcamentoAba
          dono={{ projetoId: projeto.id }}
          empresaId={projeto.empresa_id}
          areas={areas}
          onAreasChange={setAreas}
          servicosEmpresa={servicosEmpresa}
          precos={precos}
        />
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
      {verFinanceiro && (
        <TabsContent value="financeiro">
          <FinanceiroObra
            projeto={projeto}
            recebimentos={recebimentos}
            onRecebimentosChange={setRecebimentos}
            totalGasto={totalGasto}
            hoje={hoje}
            disponivel={financeiroDisponivel}
          />
        </TabsContent>
      )}
      {cliente && (
        <TabsContent value="pos-venda">
          <PosVendaPainel
            itens={posVenda}
            cliente={{ id: cliente.id, empresa_id: cliente.empresa_id, nome: cliente.nome, telefone: cliente.telefone }}
            obras={[{ id: projeto.id, nome: projeto.nome }]}
            projeto={{ id: projeto.id, status: projeto.status }}
            linkGoogle={linkGoogle}
            hoje={hojeBrasil}
            disponivel={posVendaDisponivel}
          />
        </TabsContent>
      )}
      <TabsContent value="arquivos">
        <Frame spacing="default" className="min-w-0">
          <FramePanel>
            <ArquivosLista
              empresaId={projeto.empresa_id}
              clienteId={projeto.cliente_id}
              projetoId={projeto.id}
            />
          </FramePanel>
        </Frame>
      </TabsContent>
    </Tabs>
  )
}
