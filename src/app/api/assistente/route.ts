import { NextResponse } from 'next/server'
import { configComChave, sessaoEmpresa } from '@/lib/ia/config-servidor'
import { definirFerramentas, executarFerramenta, type ContextoExecucao } from '@/lib/ia/ferramentas'
import { mensagemErroProvedor, rodarAssistente } from '@/lib/ia/executar'
import type {
  ErroAssistente,
  FormularioContexto,
  PedidoAssistente,
  RespostaAssistente,
} from '@/lib/ia/protocolo'

export const maxDuration = 60

function erro(status: number, corpo: ErroAssistente) {
  return NextResponse.json(corpo, { status })
}

function montarSistema(empresaNome: string, pagina: string, form: FormularioContexto | null | undefined) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const linhas = [
    `Você é o assistente do Galaxie Obras, app de gestão de obras da empresa "${empresaNome}".`,
    'O usuário fala por voz (o texto vem de um ditado, pode ter erros de transcrição: interprete com bom senso).',
    'Seu trabalho: preencher formulários, cadastrar, editar e excluir registros usando as ferramentas.',
    '',
    'Regras:',
    '- Responda em português do Brasil, em 1 ou 2 frases curtas, dizendo o que fez.',
    '- Se há formulário aberto e o usuário descreve dados que cabem nele, use preencher_formulario (não use criar para isso).',
    '- Só use salvar_formulario quando o usuário pedir para salvar, gravar, cadastrar ou concluir.',
    '- Para editar ou excluir algo existente, use buscar primeiro para achar o id. Nunca invente ids.',
    '- Se a busca achar mais de um registro possível, pergunte qual é antes de alterar.',
    '- Excluir sempre passa por confirmação do usuário na tela; avise isso.',
    '- Se faltar informação obrigatória, pergunte de forma curta.',
    '- Valores em reais vêm como número (ex.: "dois mil e quinhentos" = 2500). Datas em AAAA-MM-DD.',
    `- Hoje é ${hoje}. Página atual: ${pagina || '/'}.`,
  ]
  if (form) {
    linhas.push(
      '',
      `Formulário aberto na tela: "${form.titulo}"${form.descricao ? ` (${form.descricao})` : ''}.`,
      `Valores atuais: ${JSON.stringify(form.valores)}`,
    )
  } else {
    linhas.push('', 'Não há formulário aberto nesta página.')
  }
  return linhas.join('\n')
}

export async function POST(request: Request) {
  const sessao = await sessaoEmpresa()
  if (!sessao) return erro(401, { erro: 'Entre na sua conta para usar o assistente.' })

  let pedido: PedidoAssistente
  try {
    pedido = (await request.json()) as PedidoAssistente
  } catch {
    return erro(400, { erro: 'Pedido inválido.' })
  }
  const texto = typeof pedido.texto === 'string' ? pedido.texto.trim().slice(0, 4000) : ''
  if (!texto) return erro(400, { erro: 'Não ouvi nada. Tente falar de novo.' })

  let config
  try {
    config = await configComChave(sessao.supabase, sessao.empresaId)
  } catch (e) {
    return erro(500, { erro: e instanceof Error ? e.message : 'Erro ao ler a configuração da IA.' })
  }
  if (!config) {
    return erro(400, {
      erro: 'Configure uma chave de API em Ajustes para usar o assistente.',
      semConfiguracao: true,
    })
  }

  const formulario = pedido.formulario ?? null
  const historico = Array.isArray(pedido.historico)
    ? pedido.historico
        .filter((m) => (m.papel === 'usuario' || m.papel === 'assistente') && typeof m.texto === 'string')
        .slice(-10)
    : []

  const ctx: ContextoExecucao = {
    supabase: sessao.supabase,
    empresaId: sessao.empresaId,
    formulario,
    acoes: [],
  }

  try {
    const resposta = await rodarAssistente({
      ...config,
      sistema: montarSistema(sessao.empresaNome, String(pedido.pagina ?? ''), formulario),
      historico,
      texto,
      ferramentas: definirFerramentas(formulario),
      executar: (nome, args) => executarFerramenta(nome, args, ctx),
    })
    const corpo: RespostaAssistente = { resposta, acoes: ctx.acoes }
    return NextResponse.json(corpo)
  } catch (e) {
    // O que já foi gravado antes do erro precisa chegar na tela (atualizar a
    // lista, avisar), senão o usuário repete o pedido e duplica o registro.
    const feitas = ctx.acoes.length ? ' O que já tinha sido feito antes do erro foi mantido.' : ''
    return erro(502, { erro: mensagemErroProvedor(e) + feitas, acoes: ctx.acoes })
  }
}
