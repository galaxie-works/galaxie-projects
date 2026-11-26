import { isFilterRule } from '@/components/reui/filters/filters-query'
import type { FilterNode, FilterQuery, FilterRule } from '@/components/reui/filters/filters-types'

// Aplica um FilterQuery de campos "select" a uma lista, percorrendo a árvore
// (grupos aninhados com seus próprios combinadores E/OU).
// `ler(item, campo)` devolve o valor do item para o id do campo.
export function aplicarFiltroSelect<T>(
  itens: T[],
  query: FilterQuery,
  ler: (item: T, campo: string) => string | null | undefined
): T[] {
  if (query.rules.length === 0) return itens
  return itens.filter((item) => atende(item, query, ler))
}

function atende<T>(
  item: T,
  no: FilterNode,
  ler: (item: T, campo: string) => string | null | undefined
): boolean {
  if (isFilterRule(no)) {
    // Regra ainda incompleta na UI (sem operador ou sem valor) não filtra.
    const semValor =
      no.operator !== 'empty' &&
      no.operator !== 'not_empty' &&
      (no.value === undefined || (Array.isArray(no.value) && no.value.length === 0))
    if (!no.operator || semValor) return true
    return atendeRegra(item, no, ler)
  }
  if (no.rules.length === 0) return true
  return no.combinator === 'or'
    ? no.rules.some((filho) => atende(item, filho, ler))
    : no.rules.every((filho) => atende(item, filho, ler))
}

function atendeRegra<T>(
  item: T,
  regra: FilterRule,
  ler: (item: T, campo: string) => string | null | undefined
): boolean {
  const valor = ler(item, regra.path[0]) ?? ''
  const valores = Array.isArray(regra.value) ? regra.value.map(String) : [String(regra.value)]
  let ok: boolean
  switch (regra.operator) {
    case 'is':
    case 'is_any_of':
      ok = valores.includes(valor)
      break
    case 'is_not':
    case 'is_none_of':
      ok = !valores.includes(valor)
      break
    case 'empty':
      ok = valor === ''
      break
    case 'not_empty':
      ok = valor !== ''
      break
    default:
      ok = true
  }
  return regra.negated ? !ok : ok
}
