// Mensagens prontas para abrir no WhatsApp a partir do cliente.

export type ModeloWhatsApp = { id: string; rotulo: string; texto: string }

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? ''
}

export function modelosWhatsApp({
  nome,
  obra,
  empresa,
}: {
  nome: string
  /** Nome da obra mais recente, quando houver. */
  obra?: string | null
  empresa?: string | null
}): ModeloWhatsApp[] {
  const n = primeiroNome(nome)
  const daEmpresa = empresa ? ` Aqui é da ${empresa}.` : ''
  const daObra = obra ? ` da obra ${obra}` : ''
  return [
    {
      id: 'ola',
      rotulo: 'Saudação',
      texto: `Olá, ${n}! Tudo bem?${daEmpresa}`,
    },
    {
      id: 'visita',
      rotulo: 'Agendar visita técnica',
      texto: `Olá, ${n}!${daEmpresa} Podemos agendar a visita técnica para conferir as medidas? Qual dia e horário ficam melhores para você?`,
    },
    {
      id: 'orcamento',
      rotulo: 'Orçamento pronto',
      texto: `Olá, ${n}! O orçamento${daObra} está pronto. Posso te enviar os detalhes por aqui?`,
    },
    {
      id: 'retorno',
      rotulo: 'Retorno da proposta',
      texto: `Olá, ${n}! Conseguiu avaliar o orçamento${daObra}? Fico à disposição para tirar qualquer dúvida.`,
    },
    {
      id: 'andamento',
      rotulo: 'Andamento da obra',
      texto: `Olá, ${n}! Passando para atualizar o andamento${daObra}: `,
    },
    {
      id: 'avaliacao',
      rotulo: 'Pedir avaliação',
      texto: `Olá, ${n}! Como está tudo depois da obra? Sua avaliação nos ajuda muito. Pode deixar sua opinião para nós?`,
    },
  ]
}
