# Galaxie Obras

App de gestão de obras: cadastro de empresa, equipe, clientes (PF/PJ) e
projetos (obras), com dashboard de progresso, prazos e orçamento por
projeto. Interface pensada para rodar como app instalável no Android
(PWA) e com suporte a **ditado por voz** em praticamente todos os campos
de texto.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase** — banco Postgres + autenticação (e-mail/senha) + Row Level
  Security
- **Web Speech API** do navegador para ditado por voz (pt-BR) — não
  depende de nenhum serviço pago
- Deploy em **Vercel**

Não existe backend separado: o front-end fala diretamente com o
Supabase (client-side e server-side) usando as policies de RLS para
garantir que cada usuário só vê os próprios dados.

## Estrutura do projeto

```
src/
  app/
    login/                 página de login
    cadastro/               página de criação de conta
    onboarding/             fluxo de configuração inicial (chat)
    (dashboard)/            grupo de rotas autenticadas (sidebar + conteúdo)
      layout.tsx            busca empresa + lista de projetos, monta a sidebar
      projetos/              listagem, criação e dashboard de cada projeto
      clientes/               listagem, criação e detalhe de cliente
      equipe/                 cadastro da equipe
      empresa/                dados da empresa
    page.tsx                redireciona para /login, /onboarding ou /projetos
    proxy.ts                "middleware" do Next 16 — protege rotas e
                            mantém a sessão do Supabase atualizada
  components/               componentes de UI e formulários (client components)
  lib/supabase/              clients do Supabase (browser, server, proxy)
  types/                     tipos TypeScript que espelham o schema do banco
supabase/
  schema.sql                script único com todas as tabelas, RLS e índices
```

> Nota sobre o Next.js 16: o arquivo de interceptação de requisições se
> chama `proxy.ts` (antigo `middleware.ts` foi renomeado pelo framework).
> Páginas usam `params`/`searchParams` como `Promise` (precisam de
> `await`). Isso já está tudo implementado — só deixando registrado caso
> você compare com tutoriais mais antigos de Next.js.

## Modelo de dados

Uma conta (usuário autenticado) tem **uma empresa**. A partir daí:

```
empresas (1) ──< equipe (N)
empresas (1) ──< clientes (N) ──< projetos (N)
                                   projetos (1) ──< etapas (N)
                                   projetos (1) ──< compras (N)
```

- **empresas**: nome, CNPJ (opcional), o que a empresa faz, como o dono
  conduz as obras.
- **equipe**: pessoas que trabalham com o dono (nome, função/responsabilidade,
  telefone).
- **clientes**: pessoa física (nome, CPF) ou jurídica (razão social, CNPJ),
  com e-mail, telefone e endereço.
- **projetos**: pertence a um cliente; tem status (planejamento / em
  execução / pausado / completo), percentual de conclusão, datas de
  início/prazo e orçamento total.
- **etapas**: tarefas/fases de um projeto, cada uma com responsável
  (da equipe) e status (pendente / em andamento / concluída).
- **compras**: materiais/gastos lançados num projeto, cada um com
  responsável e valor — soma das compras = total gasto, comparado ao
  orçamento no dashboard do projeto.

Toda a segurança de acesso é feita via **Row Level Security** no
Postgres: cada tabela filha só é visível se a empresa correspondente
pertence ao usuário logado (`auth.uid()`). Isso está todo definido em
`supabase/schema.sql`.

## Como configurar o Supabase (uma vez só)

1. Crie um projeto em [supabase.com](https://supabase.com) (plano free
   já serve).
2. No painel, vá em **SQL Editor** → cole o conteúdo inteiro de
   `supabase/schema.sql` → **Run**. Isso cria todas as tabelas, políticas
   de segurança e índices.
3. Em **Authentication → Providers → Email**, se quiser testar rápido
   sem precisar confirmar e-mail, desative "Confirm email" (em
   **Authentication → Settings**). Em produção, o ideal é deixar
   confirmação de e-mail ativada.
4. Em **Project Settings → API**, copie:
   - **Project URL** → vai em `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
```

Essas mesmas duas variáveis precisam ser cadastradas na Vercel em
**Project Settings → Environment Variables** (ambiente Production e
Preview) antes do deploy funcionar de verdade — sem elas o app builda,
mas nenhuma tela que depende de login funciona.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Crie uma conta em `/cadastro`, você cai
automaticamente no onboarding (chat de configuração inicial) e depois
no dashboard de projetos.

## Deploy na Vercel

1. Repositório já conectado ao projeto Vercel (framework detectado
   automaticamente: Next.js).
2. Adicione as duas variáveis de ambiente citadas acima em
   **Environment Variables**.
3. Clique em **Deploy**. Qualquer novo `git push` na branch principal
   dispara um novo deploy automaticamente.

### Usando como app no Android (PWA)

Depois de publicado, abra a URL da Vercel no Chrome do Android → menu
(⋮) → **Adicionar à tela inicial**. O app abre em tela cheia, com ícone
próprio, como se fosse nativo. (Um manifest/PWA mais completo com ícones
dedicados e modo offline fica como próximo passo — ver Roadmap.)

## Funcionalidades implementadas

- Login / cadastro com Supabase Auth
- **Onboarding conversacional** (estilo chat, texto ou voz): nome da
  empresa, CNPJ, o que a empresa faz, como o usuário conduz as obras,
  se trabalha sozinho ou com equipe (nome + função de cada pessoa)
- Ditado por voz (🎙️) em todos os campos de texto relevantes (Web
  Speech API, pt-BR) — funciona em Chrome/Android; em navegadores sem
  suporte o botão simplesmente não aparece
- Sidebar com lista de projetos (linha por projeto), filtro por status,
  navegação para Clientes / Equipe / Empresa
- Cadastro de clientes **PF ou PJ** com campos específicos de cada tipo
- Um cliente pode ter vários projetos vinculados
- Dashboard por projeto: status editável, barra de progresso (%)
  editável, orçamento total vs. total gasto (somado das compras),
  datas de início/prazo (com aviso de prazo vencido), lista de etapas
  com responsável e status (clique para avançar o status), lista de
  compras/materiais com responsável e valor
- Gestão de equipe (adicionar/remover pessoas e suas funções)
- Edição dos dados da empresa

## Roadmap / próximos passos sugeridos

- Edição de clientes e projetos já existentes (hoje só criação +
  edição de status/percentual/etapas/compras)
- Upload de fotos da obra por etapa
- Manifest PWA dedicado (ícone, splash screen, modo offline básico)
- Notificações de prazo próximo/vencido
- Múltiplos usuários por empresa (hoje é 1 conta = 1 empresa)
- Relatórios/exportação (PDF ou Excel) por projeto
