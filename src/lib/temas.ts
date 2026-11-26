// Temas de cor do app. As variáveis de cada um ficam em src/app/temas.css;
// o padrão ("claude") vive em :root/.dark e os demais em <html data-theme="slug">.
// `cor` é o nome da cor de destaque, mostrado no tooltip do seletor.
// Cada tema tem versão clara e escura (classe .dark, controlada pelo next-themes).
export const TEMAS = [
  { slug: 'claude', cor: 'Terracota', nome: 'Claude +' },
  { slug: 'supabase', cor: 'Verde', nome: 'Supabase' },
  { slug: 'brutalist', cor: 'Esmeralda', nome: 'MX Brutalist' },
  { slug: 'alpha', cor: 'Azul-marinho', nome: 'Alpha' },
  { slug: 'vs-code', cor: 'Azul', nome: 'VS Code' },
  { slug: 'stella', cor: 'Âmbar', nome: 'Stella' },
  { slug: 'typewriter', cor: 'Preto e branco', nome: 'Typewriter' },
] as const

export type TemaSlug = (typeof TEMAS)[number]['slug']

export const TEMA_PADRAO: TemaSlug = 'claude'
// Cookie lido no layout raiz para já renderizar o <html> com o tema certo.
export const TEMA_COOKIE = 'galaxie-tema'

export function temaValido(valor: string | null | undefined): valor is TemaSlug {
  return TEMAS.some((t) => t.slug === valor)
}
