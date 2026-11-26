import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcaoAssistente, FormularioContexto, TabelaAssistente, PerguntaAssistente } from './protocolo'

// Ferramentas que a IA pode chamar. Leitura, criação e edição rodam aqui no
// servidor, com a sessão do usuário (o RLS do Supabase garante que só mexe
// nos dados da própria empresa). Excluir NUNCA roda aqui: vira uma ação que a
// tela mostra para o usuário confirmar. Preencher e salvar formulário também
// voltam como ações, porque o formulário está no navegador.

export interface DefinicaoFerramenta {
  nome: string
  descricao: string
  parametros: Record<string, unknown>
}

interface EspecTabela {
  rotulo: string
  /** Colunas que a IA pode ler e gravar (empresa_id é sempre automático). */
  colunas: Record<string, Record<string, unknown>>
  obrigatorias: string[]
  /** true: a tabela tem empresa_id; false: pertence a um projeto. */
  daEmpresa: boolean
  /** Coluna usada na busca por texto. */
  colunaTexto: string
  /** Como descrever um registro para o usuário. */
  descrever: (r: Record<string, unknown>) => string
  caminho?: (r: Record<string, unknown>) => string
}

const DATA = { type: 'string', description: 'Data no formato AAAA-MM-DD' }
const UUID = { type: 'string', description: 'id (uuid) obtido com a ferramenta buscar' }

export const TABELAS: Record<TabelaAssistente, EspecTabela> = {
  clientes: {
    rotulo: 'cliente',
    colunas: {
      tipo: { type: 'string', enum: ['PF', 'PJ'], description: 'PF pessoa física, PJ pessoa jurídica' },
      nome: { type: 'string', description: 'Nome (PF) ou nome fantasia (PJ)' },
      cpf: { type: 'string', description: 'CPF no formato 000.000.000-00' },
      cnpj: { type: 'string', description: 'CNPJ no formato 00.000.000/0000-00' },
      razao_social: { type: 'string' },
      email: { type: 'string' },
      telefone: { type: 'string', description: 'Telefone no formato E.164, ex. +5511987654321' },
      endereco: { type: 'string', description: 'Endereço da obra' },
    },
    obrigatorias: ['tipo', 'nome'],
    daEmpresa: true,
    colunaTexto: 'nome',
    descrever: (r) => `o cliente "${r.nome}"`,
    caminho: (r) => `/clientes/${r.id}`,
  },
  projetos: {
    rotulo: 'projeto',
    colunas: {
      cliente_id: UUID,
      nome: { type: 'string' },
      status: { type: 'string', enum: ['planejamento', 'em_execucao', 'pausado', 'completo'] },
      percentual_conclusao: { type: 'integer', minimum: 0, maximum: 100 },
      data_inicio: DATA,
      data_prazo: DATA,
      orcamento_total: { type: 'number', description: 'Valor em reais' },
    },
    obrigatorias: ['cliente_id', 'nome'],
    daEmpresa: true,
    colunaTexto: 'nome',
    descrever: (r) => `o projeto "${r.nome}"`,
    caminho: (r) => `/projetos/${r.id}`,
  },
  etapas: {
    rotulo: 'etapa',
    colunas: {
      projeto_id: UUID,
      nome: { type: 'string' },
      responsavel_id: { ...UUID, description: 'id de alguém da equipe' },
      status: { type: 'string', enum: ['pendente', 'em_andamento', 'concluida'] },
      data_prazo: DATA,
      ordem: { type: 'integer' },
    },
    obrigatorias: ['projeto_id', 'nome'],
    daEmpresa: false,
    colunaTexto: 'nome',
    descrever: (r) => `a etapa "${r.nome}"`,
  },
  compras: {
    rotulo: 'compra',
    colunas: {
      projeto_id: UUID,
      descricao: { type: 'string' },
      valor: { type: 'number', description: 'Valor em reais' },
      responsavel_id: { ...UUID, description: 'id de alguém da equipe' },
      data: DATA,
    },
    obrigatorias: ['projeto_id', 'descricao', 'valor'],
    daEmpresa: false,
    colunaTexto: 'descricao',
    descrever: (r) => `a compra "${r.descricao}"`,
  },
  equipe: {
    rotulo: 'pessoa da equipe',
    colunas: {
      nome: { type: 'string' },
      funcao: { type: 'string', description: 'O que a pessoa faz' },
      telefone: { type: 'string', description: 'Telefone no formato E.164' },
    },
    obrigatorias: ['nome'],
    daEmpresa: true,
    colunaTexto: 'nome',
    descrever: (r) => `${r.nome} da equipe`,
  },
}

const NOMES_TABELAS = Object.keys(TABELAS) as TabelaAssistente[]

const DESCRICAO_TABELAS = NOMES_TABELAS.map((t) => {
  const e = TABELAS[t]
  return `- ${t}: ${Object.keys(e.colunas).join(', ')} (obrigatórias ao criar: ${e.obrigatorias.join(', ')})`
}).join('\n')

export function definirFerramentas(form: FormularioContexto | null | undefined): DefinicaoFerramenta[] {
  const lista: DefinicaoFerramenta[] = [
    {
      nome: 'buscar',
      descricao:
        'Busca registros da empresa. Use antes de editar ou excluir para achar o id, e para responder perguntas. ' +
        'Colunas por tabela:\n' + DESCRICAO_TABELAS,
      parametros: {
        type: 'object',
        properties: {
          tabela: { type: 'string', enum: NOMES_TABELAS },
          texto: { type: 'string', description: 'Parte do nome/descrição (sem acento também funciona mal; tente variações).' },
          filtros: {
            type: 'object',
            description: 'Igualdade exata por coluna, ex. {"projeto_id": "..."} ou {"status": "em_execucao"}',
            additionalProperties: { type: ['string', 'number', 'boolean'] },
          },
          limite: { type: 'integer', minimum: 1, maximum: 50 },
        },
        required: ['tabela'],
      },
    },
    {
      nome: 'criar',
      descricao:
        'Cria um registro novo e grava na hora. Use quando o usuário pedir para cadastrar/adicionar algo que NÃO é o formulário aberto na tela.',
      parametros: {
        type: 'object',
        properties: {
          tabela: { type: 'string', enum: NOMES_TABELAS },
          dados: { type: 'object', description: 'Colunas e valores (ver ferramenta buscar).' },
        },
        required: ['tabela', 'dados'],
      },
    },
    {
      nome: 'atualizar',
      descricao: 'Altera colunas de um registro existente (precisa do id, obtido com buscar). Grava na hora.',
      parametros: {
        type: 'object',
        properties: {
          tabela: { type: 'string', enum: NOMES_TABELAS },
          id: UUID,
          dados: { type: 'object', description: 'Só as colunas que mudam.' },
        },
        required: ['tabela', 'id', 'dados'],
      },
    },
    {
      nome: 'excluir',
      descricao:
        'Pede a exclusão de um registro (precisa do id, obtido com buscar). Não exclui na hora: o app mostra uma confirmação ao usuário.',
      parametros: {
        type: 'object',
        properties: { tabela: { type: 'string', enum: NOMES_TABELAS }, id: UUID },
        required: ['tabela', 'id'],
      },
    },
    {
      nome: 'abrir_pagina',
      descricao:
        'Leva o usuário para uma página do app: /projetos, /projetos/novo, /projetos/<id>, /clientes, /clientes/novo, /clientes/<id>, /equipe, /empresa, /ajustes.',
      parametros: {
        type: 'object',
        properties: { caminho: { type: 'string' } },
        required: ['caminho'],
      },
    },
  ]

  if (form) {
    const propriedades = Object.fromEntries(
      form.campos.map((c) => [c.nome, { ...c.esquema, description: c.descricao }]),
    )
    lista.push({
      nome: 'preencher_formulario',
      descricao:
        `Preenche campos do formulário aberto na tela ("${form.titulo}"). Mande só os campos que o usuário informou ou que mudam. ` +
        'Não grava no banco: o usuário revisa na tela.',
      parametros: { type: 'object', properties: propriedades },
    })
    if (form.podeSalvar) {
      lista.push({
        nome: 'salvar_formulario',
        descricao: `Clica em salvar no formulário "${form.titulo}". Use só quando o usuário pedir para salvar/gravar/concluir.`,
        parametros: { type: 'object', properties: {} },
      })
    }
  }
  lista.push({
    nome: 'perguntar',
    descricao:
      'Mostra ao usuário UMA pergunta com 2 a 4 opções clicáveis (ele também pode responder falando). ' +
      'Use quando precisar de uma escolha (ex.: qual cliente, qual status, qual tipo de serviço). ' +
      'Busque antes para oferecer opções reais. Marque recomendada=true em no máximo uma. ' +
      'Depois de chamar, pare: a resposta do usuário chega na próxima mensagem.',
    parametros: {
      type: 'object',
      properties: {
        pergunta: { type: 'string', description: 'A pergunta, curta e direta.' },
        opcoes: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              rotulo: { type: 'string', description: 'Nome curto da opção.' },
              descricao: { type: 'string', description: 'Uma frase sobre o que acontece se escolher.' },
              recomendada: { type: 'boolean' },
            },
            required: ['rotulo'],
          },
        },
      },
      required: ['pergunta', 'opcoes'],
    },
  })
  return lista
}

// ----------------------------------------------------------------------------
// Execução
// ----------------------------------------------------------------------------

export interface ContextoExecucao {
  supabase: SupabaseClient
  empresaId: string
  formulario: FormularioContexto | null | undefined
  acoes: AcaoAssistente[]
  passos: string[]
  /** Pergunta feita nesta resposta; com ela o laço para e espera o usuário. */
  pergunta?: PerguntaAssistente
}

const PLURAL: Record<TabelaAssistente, string> = {
  clientes: 'clientes',
  projetos: 'projetos',
  etapas: 'etapas',
  compras: 'compras',
  equipe: 'equipe',
}

/** Frase curta do passo, mostrada no painel como no app do Claude. */
function descreverPasso(nome: string, args: Record<string, unknown>): string {
  const t = args.tabela as TabelaAssistente | undefined
  const rotulo = t && t in TABELAS ? TABELAS[t].rotulo : 'registro'
  const texto = typeof args.texto === 'string' && args.texto.trim() ? ` "${args.texto.trim()}"` : ''
  switch (nome) {
    case 'buscar':
      return `Buscou ${t && t in PLURAL ? PLURAL[t] : 'registros'}${texto}`
    case 'criar':
      return `Cadastrou ${rotulo}`
    case 'atualizar':
      return `Atualizou ${rotulo}`
    case 'excluir':
      return `Pediu para excluir ${rotulo}`
    case 'preencher_formulario':
      return 'Preencheu o formulário'
    case 'salvar_formulario':
      return 'Salvou o formulário'
    case 'abrir_pagina':
      return `Abriu ${String(args.caminho ?? 'a página')}`
    default:
      return nome
  }
}

function ehTabela(t: unknown): t is TabelaAssistente {
  return typeof t === 'string' && t in TABELAS
}

function limparDados(tabela: TabelaAssistente, dados: unknown): Record<string, unknown> {
  if (!dados || typeof dados !== 'object') return {}
  const permitidas = TABELAS[tabela].colunas
  return Object.fromEntries(
    Object.entries(dados as Record<string, unknown>).filter(([k]) => k in permitidas),
  )
}

function colunasSelect(tabela: TabelaAssistente) {
  return ['id', ...Object.keys(TABELAS[tabela].colunas)].join(', ')
}

/** Executa uma ferramenta e devolve o texto que volta para a IA. */
export async function executarFerramenta(
  nome: string,
  args: Record<string, unknown>,
  ctx: ContextoExecucao,
): Promise<string> {
  const { supabase, empresaId } = ctx

  if (nome === 'perguntar') {
    if (ctx.pergunta) return 'Erro: só uma pergunta por vez. Espere a resposta do usuário.'
    const pergunta = typeof args.pergunta === 'string' ? args.pergunta.trim() : ''
    const opcoes = (Array.isArray(args.opcoes) ? args.opcoes : [])
      .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
      .map((o) => ({
        rotulo: String(o.rotulo ?? '').trim().slice(0, 80),
        descricao: typeof o.descricao === 'string' ? o.descricao.trim().slice(0, 200) : undefined,
        recomendada: o.recomendada === true,
      }))
      .filter((o) => o.rotulo)
      .slice(0, 4)
    if (!pergunta || opcoes.length < 2) return 'Erro: mande a pergunta e de 2 a 4 opções.'
    // No máximo uma recomendada.
    let jaTem = false
    for (const o of opcoes) {
      if (o.recomendada && jaTem) o.recomendada = false
      if (o.recomendada) jaTem = true
    }
    ctx.pergunta = { pergunta: pergunta.slice(0, 200), opcoes }
    return 'Pergunta mostrada. Pare aqui e espere a resposta do usuário.'
  }

  ctx.passos.push(descreverPasso(nome, args))

  if (nome === 'preencher_formulario') {
    if (!ctx.formulario) return 'Erro: não há formulário aberto na tela.'
    const nomes = new Set(ctx.formulario.campos.map((c) => c.nome))
    const valores = Object.fromEntries(Object.entries(args).filter(([k]) => nomes.has(k)))
    ctx.acoes.push({ tipo: 'preencher', formularioId: ctx.formulario.id, valores })
    return `Campos enviados para a tela: ${Object.keys(valores).join(', ') || 'nenhum'}.`
  }
  if (nome === 'salvar_formulario') {
    if (!ctx.formulario?.podeSalvar) return 'Erro: este formulário não pode ser salvo pelo assistente.'
    ctx.acoes.push({ tipo: 'salvar', formularioId: ctx.formulario.id })
    return 'O app vai salvar o formulário agora (se faltar algum campo obrigatório, ele mostra o erro na tela).'
  }
  if (nome === 'abrir_pagina') {
    const caminho = String(args.caminho ?? '')
    if (!caminho.startsWith('/') || caminho.startsWith('//')) return 'Erro: caminho inválido.'
    ctx.acoes.push({ tipo: 'navegar', caminho })
    return `Abrindo ${caminho}.`
  }

  const tabela = args.tabela
  if (!ehTabela(tabela)) return `Erro: tabela inválida. Use uma de: ${NOMES_TABELAS.join(', ')}.`
  const espec = TABELAS[tabela]

  if (nome === 'buscar') {
    const limite = Math.min(Math.max(Number(args.limite) || 20, 1), 50)
    let q = supabase.from(tabela).select(colunasSelect(tabela)).limit(limite)
    if (espec.daEmpresa) q = q.eq('empresa_id', empresaId)
    if (typeof args.texto === 'string' && args.texto.trim()) {
      q = q.ilike(espec.colunaTexto, `%${args.texto.trim().replace(/[%_]/g, '')}%`)
    }
    const filtros = limparDados(tabela, args.filtros)
    for (const [k, v] of Object.entries(filtros)) q = q.eq(k, v as string)
    const { data, error } = await q
    if (error) return `Erro ao buscar: ${error.message}`
    return JSON.stringify(data ?? [])
  }

  if (nome === 'criar') {
    const dados = limparDados(tabela, args.dados)
    const faltando = espec.obrigatorias.filter((c) => dados[c] === undefined || dados[c] === '')
    if (faltando.length) return `Erro: faltam campos obrigatórios: ${faltando.join(', ')}. Pergunte ao usuário.`
    if (espec.daEmpresa) dados.empresa_id = empresaId
    const { data, error } = await supabase.from(tabela).insert(dados).select(colunasSelect(tabela)).single()
    if (error) return `Erro ao criar: ${error.message}`
    ctx.acoes.push({ tipo: 'atualizar' })
    return `Criado: ${JSON.stringify(data)}`
  }

  const id = typeof args.id === 'string' ? args.id : ''
  if (!id) return 'Erro: informe o id (use buscar antes).'

  if (nome === 'atualizar') {
    const dados = limparDados(tabela, args.dados)
    if (!Object.keys(dados).length) return 'Erro: nenhuma coluna válida para alterar.'
    let q = supabase.from(tabela).update(dados).eq('id', id)
    if (espec.daEmpresa) q = q.eq('empresa_id', empresaId)
    const { data, error } = await q.select(colunasSelect(tabela)).maybeSingle()
    if (error) return `Erro ao atualizar: ${error.message}`
    if (!data) return 'Erro: registro não encontrado.'
    ctx.acoes.push({ tipo: 'atualizar' })
    return `Atualizado: ${JSON.stringify(data)}`
  }

  if (nome === 'excluir') {
    let q = supabase.from(tabela).select(colunasSelect(tabela)).eq('id', id)
    if (espec.daEmpresa) q = q.eq('empresa_id', empresaId)
    const { data, error } = await q.maybeSingle()
    if (error) return `Erro: ${error.message}`
    if (!data) return 'Erro: registro não encontrado.'
    const registro = data as unknown as Record<string, unknown>
    ctx.acoes.push({ tipo: 'excluir', tabela, id, descricao: espec.descrever(registro) })
    return `Pedido de exclusão de ${espec.descrever(registro)} enviado. O usuário precisa confirmar na tela; diga isso a ele.`
  }

  return `Erro: ferramenta desconhecida "${nome}".`
}
