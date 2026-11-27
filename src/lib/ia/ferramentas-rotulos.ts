import type { TabelaAssistente } from './protocolo'

// Nome de cada tabela para mostrar na tela (ex.: "Excluir cliente?").
export const TABELAS: Record<TabelaAssistente, string> = {
  clientes: 'cliente',
  projetos: 'projeto',
  etapas: 'etapa',
  compras: 'compra',
  equipe: 'pessoa da equipe',
  recebimentos: 'parcela a receber',
  pos_venda: 'item de pós-venda',
}
