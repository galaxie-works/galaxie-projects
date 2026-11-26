import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { DefinicaoFerramenta } from './ferramentas'
import type { MensagemHistorico } from './protocolo'
import type { ProvedorIA } from './provedores'

// Laço de conversa com ferramentas, um por família de API. A IA pede uma
// ferramenta, o servidor executa (`executar`) e devolve o resultado, até a IA
// responder em texto ou bater o limite de voltas.

const MAX_VOLTAS = 8

export interface ParametrosLaco {
  provedor: ProvedorIA
  modelo: string
  chave: string
  sistema: string
  historico: MensagemHistorico[]
  texto: string
  ferramentas: DefinicaoFerramenta[]
  executar: (nome: string, args: Record<string, unknown>) => Promise<string>
  /** true depois de uma ferramenta que espera o usuário (ex.: perguntar). */
  parar?: () => boolean
}

export async function rodarAssistente(p: ParametrosLaco): Promise<string> {
  return p.provedor === 'anthropic' ? rodarAnthropic(p) : rodarCompativelOpenAI(p)
}

function lerArgs(bruto: unknown): Record<string, unknown> {
  if (bruto && typeof bruto === 'object') return bruto as Record<string, unknown>
  if (typeof bruto === 'string') {
    try {
      const v = JSON.parse(bruto)
      return v && typeof v === 'object' ? v : {}
    } catch {
      return {}
    }
  }
  return {}
}

// ----------------------------------------------------------------------------
// Anthropic (Claude)
// ----------------------------------------------------------------------------

// Modelos que aceitam o fallback automático do servidor em caso de recusa.
const COM_FALLBACK = new Set(['claude-opus-5-5', 'claude-sonnet-5-5'])

async function rodarAnthropic(p: ParametrosLaco): Promise<string> {
  const client = new Anthropic({ apiKey: p.chave, maxRetries: 1, timeout: 60_000 })
  const tools: Anthropic.Beta.BetaTool[] = p.ferramentas.map((f) => ({
    name: f.nome,
    description: f.descricao,
    input_schema: f.parametros as Anthropic.Beta.BetaTool['input_schema'],
  }))
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...p.historico.map((m) => ({
      role: m.papel === 'usuario' ? ('user' as const) : ('assistant' as const),
      content: m.texto,
    })),
    { role: 'user', content: p.texto },
  ]

  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const fallback = COM_FALLBACK.has(p.modelo)
    const resposta = await client.beta.messages.create({
      model: p.modelo,
      max_tokens: 8000,
      system: p.sistema,
      messages,
      tools,
      // Preencher formulário por voz precisa ser rápido.
      output_config: { effort: 'low' },
      ...(fallback
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    })

    if (resposta.stop_reason === 'refusal') {
      return 'Não consegui ajudar com esse pedido.'
    }
    // Devolve o conteúdo inteiro (inclusive blocos de raciocínio) sem alterar.
    messages.push({ role: 'assistant', content: resposta.content as Anthropic.Beta.BetaContentBlockParam[] })

    const chamadas = resposta.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use',
    )
    const texto = resposta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (resposta.stop_reason !== 'tool_use' || chamadas.length === 0) {
      return texto || 'Pronto.'
    }

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const c of chamadas) {
      const saida = await p.executar(c.name, lerArgs(c.input))
      resultados.push({
        type: 'tool_result',
        tool_use_id: c.id,
        content: saida,
        ...(saida.startsWith('Erro') ? { is_error: true } : {}),
      })
    }
    if (p.parar?.()) return texto
    messages.push({ role: 'user', content: resultados })
  }
  return 'Fiz o que deu, mas parei para não demorar demais. Confira a tela.'
}

// ----------------------------------------------------------------------------
// OpenAI e DeepSeek (mesma API de chat com ferramentas)
// ----------------------------------------------------------------------------

async function rodarCompativelOpenAI(p: ParametrosLaco): Promise<string> {
  const client = new OpenAI({
    apiKey: p.chave,
    baseURL: p.provedor === 'deepseek' ? 'https://api.deepseek.com' : undefined,
    maxRetries: 1,
    timeout: 60_000,
  })
  const tools: OpenAI.Chat.ChatCompletionTool[] = p.ferramentas.map((f) => ({
    type: 'function',
    function: { name: f.nome, description: f.descricao, parameters: f.parametros },
  }))
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: p.sistema },
    ...p.historico.map((m) =>
      m.papel === 'usuario'
        ? ({ role: 'user', content: m.texto } as const)
        : ({ role: 'assistant', content: m.texto } as const),
    ),
    { role: 'user', content: p.texto },
  ]

  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const resposta = await client.chat.completions.create({ model: p.modelo, messages, tools })
    const msg = resposta.choices[0]?.message
    if (!msg) return 'Pronto.'
    messages.push(msg)

    const chamadas = (msg.tool_calls ?? []).filter((c) => c.type === 'function')
    if (chamadas.length === 0) return msg.content?.trim() || 'Pronto.'

    for (const c of chamadas) {
      const saida = await p.executar(c.function.name, lerArgs(c.function.arguments))
      messages.push({ role: 'tool', tool_call_id: c.id, content: saida })
    }
    if (p.parar?.()) return msg.content?.trim() ?? ''
  }
  return 'Fiz o que deu, mas parei para não demorar demais. Confira a tela.'
}

/** Pedido mínimo só para validar a chave na tela de ajustes. */
export async function testarChave(provedor: ProvedorIA, modelo: string, chave: string): Promise<void> {
  if (provedor === 'anthropic') {
    const client = new Anthropic({ apiKey: chave, maxRetries: 0, timeout: 30_000 })
    await client.messages.create({
      model: modelo,
      max_tokens: 64,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responda só: ok' }],
    })
    return
  }
  const client = new OpenAI({
    apiKey: chave,
    baseURL: provedor === 'deepseek' ? 'https://api.deepseek.com' : undefined,
    maxRetries: 0,
    timeout: 30_000,
  })
  await client.chat.completions.create({
    model: modelo,
    messages: [{ role: 'user', content: 'Responda só: ok' }],
  })
}

/** Mensagem de erro amigável a partir de um erro de SDK. */
export function mensagemErroProvedor(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof OpenAI.AuthenticationError) {
    return 'A chave de API foi recusada pelo provedor. Confira em Ajustes.'
  }
  if (e instanceof Anthropic.PermissionDeniedError || e instanceof OpenAI.PermissionDeniedError) {
    return 'A chave não tem permissão para esse modelo.'
  }
  if (e instanceof Anthropic.NotFoundError || e instanceof OpenAI.NotFoundError) {
    return 'Modelo não encontrado nesse provedor. Escolha outro em Ajustes.'
  }
  if (e instanceof Anthropic.RateLimitError || e instanceof OpenAI.RateLimitError) {
    return 'Limite de uso do provedor atingido (ou sem créditos). Tente de novo em instantes.'
  }
  if (e instanceof Anthropic.APIError || e instanceof OpenAI.APIError) {
    return `O provedor respondeu com erro (${e.status ?? 'sem status'}): ${e.message}`
  }
  return e instanceof Error ? e.message : 'Erro inesperado ao falar com a IA.'
}
