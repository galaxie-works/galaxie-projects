import { flattenFilterConditions } from '@/components/reui/filters/filters-query'
import type { FilterQuery } from '@/components/reui/filters/filters-types'

// Aplica um FilterQuery de campos "select" a uma lista, campo a campo.
// `ler(item, campo)` devolve o valor do item para o id do campo.
export function aplicarFiltroSelect<T>(
  itens: T[],
  query: FilterQuery,
  ler: (item: T, campo: string) => string | null | undefined
): T[] {
  const condicoes = flattenFilterConditions(query)
  if (condicoes.length === 0) return itens

  const testa = (item: T) =>
    condicoes.map((c) => {
      const valor = ler(item, c.field) ?? ''
      const valores = c.values.map(String)
      let ok: boolean
      switch (c.operator) {
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
      return c.negated ? !ok : ok
    })

  return itens.filter((item) => {
    const resultados = testa(item)
    return query.combinator === 'or' ? resultados.some(Boolean) : resultados.every(Boolean)
  })
}
