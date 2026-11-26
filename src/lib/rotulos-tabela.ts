import type { DataGridI18nOverrides } from '@/components/reui/data-grid/data-grid-i18n'
import type { FilterOperatorLabels } from '@/components/reui/filters/filters-operators'
import type { FilterLabels } from '@/components/reui/filters/filters-types'

// Textos em português para @reui/data-grid e @reui/filters.

export const ROTULOS_GRID: DataGridI18nOverrides = {
  labels: {
    sortAscending: 'Crescente',
    sortDescending: 'Decrescente',
    loading: 'Carregando…',
    empty: 'Nada por aqui',
    rowsPerPage: 'Por página',
    paginationInfo: ({ from, to, count }) => `${from}–${to} de ${count}`,
    previousPage: 'Página anterior',
    nextPage: 'Próxima página',
    goToPage: (page) => `Ir para a página ${page}`,
  },
}

export const ROTULOS_FILTROS: Partial<FilterLabels> = {
  addFilter: 'Filtrar',
  clearAll: 'Limpar',
  clear: 'Limpar',
  apply: 'Aplicar',
  back: 'Voltar',
  remove: 'Remover',
  negate: 'Inverter',
  duplicate: 'Duplicar',
  discard: 'Descartar',
  empty: 'Nenhum resultado',
  loading: 'Carregando…',
  searchFields: 'Buscar campo…',
  searchOperators: 'Buscar condição…',
  searchOptions: 'Buscar…',
  selectPlaceholder: 'Selecione…',
  valuePlaceholder: 'digite…',
  selectCondition: 'Escolha a condição',
  noValue: 'sem valor',
  filtersLabel: 'Filtros',
  fieldsLabel: 'Campos',
  actionsLabel: 'Ações',
  chipMenu: (campo) => `Opções do filtro ${campo}`,
  valueCount: (total) => `${total} selecionados`,
  itemCount: (total) => `${total} itens`,
  countAnnouncement: (total) => (total === 1 ? '1 filtro aplicado' : `${total} filtros aplicados`),
  resultsAnnouncement: (total) => (total === 1 ? '1 resultado' : `${total} resultados`),
  negated: (operador) => `não ${operador}`,
}

export const ROTULOS_OPERADORES: FilterOperatorLabels = {
  is: 'é',
  is_not: 'não é',
  is_any_of: 'é um de',
  is_none_of: 'não é nenhum de',
  empty: 'está vazio',
  not_empty: 'não está vazio',
}
