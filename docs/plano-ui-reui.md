# Plano: UI 100% ReUI + onboarding por etapas

Status: taxonomia de serviços, coluna `empresas.servicos` e comando de voz
prontos (`src/lib/servicos.ts`). Falta instalar ReUI/shadcn e refazer as
telas — o ambiente cloud precisa liberar `reui.io` e `ui.shadcn.com`.

## Fundação (fazer primeiro, em série)

1. `npx shadcn@latest init -b base -p nova` (base-nova, Base UI, lucide).
2. Registrar `@reui` em `components.json`:
   `"registries": { "@reui": "https://reui.io/r/{style}/{name}.json" }`.
3. Instalar shadcn: `button input textarea label field input-group card
   dialog alert-dialog sheet sidebar select native-select dropdown-menu
   avatar separator skeleton tooltip progress tabs accordion checkbox
   switch toggle-group item empty spinner kbd sonner scroll-area breadcrumb`.
4. Instalar ReUI: `@reui/badge @reui/alert @reui/frame @reui/stepper
   @reui/data-grid @reui/filters @reui/kanban @reui/number-field
   @reui/phone-input @reui/date-selector @reui/icon-tile @reui/timeline`.
5. Trocar o `globals.css` artesanal pelos tokens do init; apagar
   `ProgressBar`, `StatusBadge` e classes `bg-accent`/`text-muted` antigas.
6. `<Toaster />` (sonner) e `<MotionConfig reducedMotion="user">` no root.

Regras ReUI que valem para todas as telas: componentes como vêm, sem
`rounded-*`/`shadow-*`/`h-*`/`px-*` em Button/Input/Card/Frame; estados
via variantes `-light` do Badge; `gap-*` em vez de `space-y-*`; `text-sm`
corpo, `text-xs` meta, `tabular-nums` em números; uma família de container
por tela (Frame em telas operacionais, Card em fluxos); estados empty
(`Empty`), loading (`Skeleton`) e erro (Alert + Tentar de novo) por região.

## Onboarding (surface: flow, archetype: stepper em Card centralizado)

Substitui `OnboardingChat`. `@reui/stepper` (modelo: `c-stepper-28`,
breadcrumb + barra de segmentos), 1 ação primária por etapa,
Voltar `outline` + Continuar primário.

1. **Empresa** — nome, CNPJ opcional (Field + Input com máscara).
2. **Áreas de atuação** — 5 áreas de `AREAS_SERVICO` como cartões
   selecionáveis (ToggleGroup multiple, cada item com IconTile + nome +
   descrição).
3. **Serviços** — para cada área marcada: Accordion por categoria, serviços
   como Checkbox em `Item`; contador por categoria (Badge), "selecionar
   todos" por categoria, busca. Botão de microfone: "fale o que você faz"
   → `encontrarServicosNoTexto`. Resumo em chips (Badge) no rodapé.
4. **Como você trabalha** — sozinho/com equipe (ToggleGroup), membros
   (nome + função, lista editável), texto livre do processo (Textarea +
   ditado).
5. **Revisão** — um bloco por etapa com botão **Editar** que volta à etapa;
   barra "Falar para ajustar" usando `aplicarComandoDeVoz` (ex.: "tira
   granilite e adiciona pintura externa"), com toast mostrando o que
   entrou/saiu. Confirmar salva `empresas` (+ `servicos`) e `equipe`.

O mesmo `ServicosPicker` é reutilizado em `/empresa` (aba Serviços).

## Telas do app (surface: operational, dense, Frame-led)

- **Shell**: shadcn `Sidebar` (vira Sheet no mobile). Grupos: Projetos
  (lista com ponto de status, cliente, %), Clientes, Equipe, Empresa.
  Filtro de status com `Select size="sm"`. Rodapé com Avatar + menu Sair.
- **Projetos (lista)**: KPI row (em execução, atrasados, orçamento total,
  gasto) em Frame; `data-grid` com status Badge, Progress, prazo,
  orçamento; `filters` por status/cliente.
- **Projeto (detalhe)**: record detail — header com nome, Badge de status,
  ações; Tabs: Visão geral (progresso, orçamento vs gasto, prazos),
  Etapas (`kanban` pendente / em andamento / concluída, ou lista),
  Compras (`data-grid` com total no rodapé).
- **Clientes**: `data-grid` + `filters` (PF/PJ); detalhe com dados e
  projetos vinculados; formulário PF/PJ com ToggleGroup, `phone-input`.
- **Equipe**: Frame com lista (`Item`) + Dialog para adicionar/editar.
- **Empresa**: rail de seções (Dados, Serviços, Equipe).
- **Login/Cadastro**: auth card (`max-w-sm`).

## Próximo passo sugerido (fora deste PR)

Orçamento por área no projeto: linhas Área / Piso (m²) / Metro linear /
Valor, com resumo (total m², total ml, valor do piso, lineares, total da
obra, barra Piso vs Lineares) — base para a calculadora do site e para a
IA que atualiza obras por áudio.
