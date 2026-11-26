// Taxonomia de serviços de construção e reforma usada no onboarding e no
// perfil da empresa. Três níveis: área > categoria > serviço.
//
// Montada a partir das categorias de marketplaces de serviços no Brasil
// (GetNinjas "Reformas e Reparos"), das etapas de obra usadas em orçamentos
// (grupos SINAPI: serviços preliminares, fundação, estrutura, alvenaria,
// cobertura, impermeabilização, instalações, revestimentos, esquadrias,
// pintura) e dos materiais de acabamento mais vendidos (cerâmica,
// porcelanato, pedras naturais, granilite/fulget, vinílico, laminado etc.).
//
// Os ids são estáveis e vão para o banco (empresas.servicos). Para
// renomear um rótulo, mude só o `nome`; nunca reaproveite um id.
// `sinonimos` ajuda o reconhecimento por voz ("fulgê", "granitina"...).

export interface Servico {
  id: string
  nome: string
  sinonimos?: string[]
}

export interface CategoriaServico {
  id: string
  nome: string
  descricao?: string
  servicos: Servico[]
}

export interface AreaServico {
  id: string
  nome: string
  descricao: string
  categorias: CategoriaServico[]
}

export const AREAS_SERVICO: AreaServico[] = [
  {
    id: 'construcao-reforma',
    nome: 'Construção e reformas',
    descricao: 'Obra civil, do terreno ao acabamento',
    categorias: [
      {
        id: 'preliminares',
        nome: 'Serviços preliminares',
        servicos: [
          { id: 'demolicao', nome: 'Demolição' },
          { id: 'remocao-entulho', nome: 'Remoção de entulho', sinonimos: ['caçamba'] },
          { id: 'terraplanagem', nome: 'Terraplanagem e escavação' },
          { id: 'canteiro', nome: 'Montagem de canteiro e tapume' },
          { id: 'locacao-obra', nome: 'Locação da obra (gabarito)' },
        ],
      },
      {
        id: 'fundacao-estrutura',
        nome: 'Fundação e estrutura',
        servicos: [
          { id: 'fundacao-rasa', nome: 'Fundação rasa (sapata, baldrame, radier)', sinonimos: ['baldrame', 'radier', 'sapata'] },
          { id: 'fundacao-profunda', nome: 'Fundação profunda (estaca, tubulão)', sinonimos: ['estaca', 'tubulão'] },
          { id: 'concreto-armado', nome: 'Estrutura de concreto armado', sinonimos: ['laje', 'pilar', 'viga'] },
          { id: 'estrutura-metalica', nome: 'Estrutura metálica' },
          { id: 'concretagem', nome: 'Concretagem' },
          { id: 'contencao', nome: 'Muro de arrimo e contenção' },
        ],
      },
      {
        id: 'alvenaria',
        nome: 'Alvenaria e vedação',
        servicos: [
          { id: 'alvenaria-bloco', nome: 'Alvenaria de tijolo ou bloco', sinonimos: ['parede', 'tijolo', 'bloco'] },
          { id: 'alvenaria-estrutural', nome: 'Alvenaria estrutural' },
          { id: 'reboco', nome: 'Chapisco, emboço e reboco', sinonimos: ['reboco', 'massa'] },
          { id: 'contrapiso', nome: 'Contrapiso e regularização' },
          { id: 'muro', nome: 'Muros e divisas' },
        ],
      },
      {
        id: 'drywall-gesso',
        nome: 'Gesso e drywall',
        servicos: [
          { id: 'drywall', nome: 'Paredes de drywall', sinonimos: ['drywall', 'dry wall', 'gesso acartonado'] },
          { id: 'forro-gesso', nome: 'Forro de gesso ou drywall', sinonimos: ['rebaixamento'] },
          { id: 'forro-pvc', nome: 'Forro de PVC' },
          { id: 'sanca', nome: 'Sancas e molduras' },
          { id: 'gesso-liso', nome: 'Gesso liso em parede' },
        ],
      },
      {
        id: 'revestimentos',
        nome: 'Revestimentos de piso e parede',
        descricao: 'Assentamento e acabamento de pisos e paredes',
        servicos: [
          { id: 'ceramica-porcelanato', nome: 'Cerâmica e porcelanato', sinonimos: ['cerâmica', 'porcelanato', 'azulejo'] },
          { id: 'pedras-naturais', nome: 'Pedras naturais', sinonimos: ['mármore', 'granito', 'ardósia', 'pedra miracema', 'pedra são tomé', 'quartzito'] },
          { id: 'fulget', nome: 'Fulget', sinonimos: ['fulgê', 'fulgé', 'granilite lavado'] },
          { id: 'granilite', nome: 'Granilite', sinonimos: ['granitina', 'marmorite'] },
          { id: 'cimento-queimado', nome: 'Cimento queimado e microcimento', sinonimos: ['microcimento', 'cimento queimado'] },
          { id: 'piso-epoxi', nome: 'Piso epóxi e autonivelante', sinonimos: ['epóxi', 'autonivelante', 'poliuretano'] },
          { id: 'vinilico', nome: 'Piso vinílico', sinonimos: ['vinil', 'vinílico'] },
          { id: 'laminado', nome: 'Piso laminado' },
          { id: 'madeira', nome: 'Madeira (taco, tábua corrida, assoalho)', sinonimos: ['taco', 'tábua corrida', 'assoalho', 'parquet'] },
          { id: 'ladrilho-hidraulico', nome: 'Ladrilho hidráulico' },
          { id: 'pastilhas', nome: 'Pastilhas', sinonimos: ['pastilha de vidro'] },
          { id: 'piso-intertravado', nome: 'Piso intertravado e paver', sinonimos: ['paver', 'bloquete'] },
          { id: 'piso-drenante', nome: 'Piso drenante e atérmico', sinonimos: ['atérmico', 'borda de piscina'] },
          { id: 'rodapes-soleiras', nome: 'Rodapés, soleiras e peitoris', sinonimos: ['rodapé', 'soleira', 'peitoril'] },
          { id: 'restauracao-pisos', nome: 'Restauração e polimento de pisos', sinonimos: ['polimento', 'raspagem', 'sinteco'] },
        ],
      },
      {
        id: 'pintura',
        nome: 'Pintura',
        servicos: [
          { id: 'pintura-interna', nome: 'Pintura interna' },
          { id: 'pintura-externa', nome: 'Pintura externa e fachada', sinonimos: ['fachada'] },
          { id: 'textura-grafiato', nome: 'Textura e grafiato', sinonimos: ['grafiato', 'textura'] },
          { id: 'massa-corrida', nome: 'Massa corrida e emassamento' },
          { id: 'efeitos-decorativos', nome: 'Efeitos decorativos', sinonimos: ['marmorato', 'parede de cimento'] },
          { id: 'pintura-esquadrias', nome: 'Pintura de portas, grades e esquadrias' },
          { id: 'verniz-madeira', nome: 'Verniz e stain em madeira' },
          { id: 'pintura-piso', nome: 'Pintura de piso e demarcação' },
          { id: 'papel-parede', nome: 'Papel de parede' },
        ],
      },
      {
        id: 'cobertura',
        nome: 'Cobertura e telhado',
        servicos: [
          { id: 'telhado-novo', nome: 'Telhado novo (estrutura e telhas)' },
          { id: 'reforma-telhado', nome: 'Reforma e revisão de telhado', sinonimos: ['goteira', 'telha'] },
          { id: 'calhas-rufos', nome: 'Calhas e rufos', sinonimos: ['calha', 'rufo'] },
          { id: 'laje-cobertura', nome: 'Laje de cobertura' },
          { id: 'toldos', nome: 'Toldos e coberturas leves', sinonimos: ['policarbonato', 'pergolado'] },
        ],
      },
      {
        id: 'impermeabilizacao',
        nome: 'Impermeabilização',
        servicos: [
          { id: 'imper-laje', nome: 'Laje e terraço', sinonimos: ['manta asfáltica', 'manta líquida'] },
          { id: 'imper-banheiro', nome: 'Banheiro e áreas molhadas' },
          { id: 'imper-piscina', nome: 'Piscina e reservatório' },
          { id: 'imper-baldrame', nome: 'Baldrame e paredes (umidade)', sinonimos: ['infiltração', 'mofo', 'umidade'] },
        ],
      },
      {
        id: 'esquadrias',
        nome: 'Esquadrias, serralheria e vidros',
        servicos: [
          { id: 'portas-janelas', nome: 'Portas e janelas' },
          { id: 'serralheria', nome: 'Serralheria e solda', sinonimos: ['portão', 'grade'] },
          { id: 'portao-automatico', nome: 'Portão automático' },
          { id: 'vidracaria', nome: 'Vidraçaria e box', sinonimos: ['box', 'vidro temperado', 'espelho'] },
          { id: 'guarda-corpo', nome: 'Escadas, corrimão e guarda-corpo' },
          { id: 'redes-protecao', nome: 'Redes de proteção' },
        ],
      },
      {
        id: 'marmoraria',
        nome: 'Marmoraria',
        servicos: [
          { id: 'bancadas', nome: 'Bancadas e cubas', sinonimos: ['bancada', 'pia'] },
          { id: 'escadas-pedra', nome: 'Escadas e degraus em pedra' },
          { id: 'revestimento-pedra', nome: 'Revestimento de paredes em pedra' },
          { id: 'quartzo-sintetico', nome: 'Quartzo e superfícies sintéticas', sinonimos: ['silestone', 'quartzo'] },
        ],
      },
      {
        id: 'acabamentos-finais',
        nome: 'Acabamentos finais',
        servicos: [
          { id: 'limpeza-pos-obra', nome: 'Limpeza pós-obra' },
          { id: 'rejuntamento', nome: 'Rejuntamento e troca de rejunte', sinonimos: ['rejunte'] },
          { id: 'loucas-metais', nome: 'Instalação de louças e metais', sinonimos: ['vaso', 'torneira'] },
        ],
      },
    ],
  },
  {
    id: 'instalacoes',
    nome: 'Instalações',
    descricao: 'Elétrica, hidráulica, gás e climatização',
    categorias: [
      {
        id: 'eletrica',
        nome: 'Elétrica',
        servicos: [
          { id: 'eletrica-predial', nome: 'Instalação elétrica residencial e predial' },
          { id: 'quadro-disjuntores', nome: 'Quadro de distribuição e disjuntores', sinonimos: ['quadro de luz'] },
          { id: 'padrao-entrada', nome: 'Padrão de entrada e ligação' },
          { id: 'iluminacao', nome: 'Iluminação e luminotécnica', sinonimos: ['led', 'spot'] },
          { id: 'spda', nome: 'Aterramento e para-raios (SPDA)' },
          { id: 'carregador-veicular', nome: 'Carregador de veículo elétrico' },
        ],
      },
      {
        id: 'hidraulica',
        nome: 'Hidráulica e esgoto',
        servicos: [
          { id: 'agua-fria-quente', nome: 'Água fria e quente', sinonimos: ['encanamento'] },
          { id: 'esgoto', nome: 'Esgoto e águas pluviais' },
          { id: 'caixa-dagua', nome: "Caixa d'água e reservatórios" },
          { id: 'aquecedor', nome: 'Aquecedores e pressurizadores' },
          { id: 'desentupimento', nome: 'Desentupimento e caça-vazamento', sinonimos: ['vazamento'] },
          { id: 'fossa', nome: 'Fossa e sumidouro' },
          { id: 'poco-artesiano', nome: 'Poço artesiano' },
        ],
      },
      { id: 'gas', nome: 'Gás', servicos: [
        { id: 'gas-encanado', nome: 'Rede de gás (GLP e natural)', sinonimos: ['botijão', 'central de gás'] },
      ] },
      {
        id: 'climatizacao',
        nome: 'Climatização e exaustão',
        servicos: [
          { id: 'ar-condicionado', nome: 'Ar-condicionado (instalação e infra)', sinonimos: ['split'] },
          { id: 'dutos', nome: 'Dutos e ventilação' },
          { id: 'coifas', nome: 'Coifas e exaustores' },
        ],
      },
      {
        id: 'energia-solar',
        nome: 'Energia solar',
        servicos: [
          { id: 'fotovoltaico', nome: 'Sistema fotovoltaico', sinonimos: ['placa solar', 'painel solar'] },
          { id: 'aquecimento-solar', nome: 'Aquecimento solar de água' },
        ],
      },
      {
        id: 'automacao-seguranca',
        nome: 'Automação e segurança',
        servicos: [
          { id: 'automacao', nome: 'Automação residencial' },
          { id: 'cftv', nome: 'Câmeras e alarme (CFTV)', sinonimos: ['câmera', 'alarme'] },
          { id: 'cerca-eletrica', nome: 'Cerca elétrica e concertina' },
          { id: 'rede-dados', nome: 'Rede de dados e cabeamento', sinonimos: ['wi-fi', 'internet'] },
          { id: 'sonorizacao', nome: 'Sonorização de ambientes' },
          { id: 'incendio', nome: 'Prevenção e combate a incêndio', sinonimos: ['AVCB', 'hidrante'] },
        ],
      },
    ],
  },
  {
    id: 'marcenaria-interiores',
    nome: 'Marcenaria e interiores',
    descricao: 'Móveis, projetos e decoração',
    categorias: [
      {
        id: 'marcenaria',
        nome: 'Marcenaria',
        servicos: [
          { id: 'moveis-planejados', nome: 'Móveis planejados', sinonimos: ['armário', 'cozinha planejada'] },
          { id: 'portas-madeira', nome: 'Portas e batentes' },
          { id: 'deck-madeira', nome: 'Deck de madeira' },
          { id: 'paineis-ripados', nome: 'Painéis e ripados' },
          { id: 'montagem-moveis', nome: 'Montagem de móveis' },
        ],
      },
      {
        id: 'projetos',
        nome: 'Projetos',
        servicos: [
          { id: 'arquitetura', nome: 'Projeto de arquitetura' },
          { id: 'interiores', nome: 'Design de interiores' },
          { id: 'estrutural', nome: 'Projeto estrutural' },
          { id: 'complementares', nome: 'Projetos elétrico e hidráulico' },
          { id: 'regularizacao', nome: 'Aprovação, alvará e regularização', sinonimos: ['habite-se', 'ART', 'RRT'] },
          { id: 'topografia', nome: 'Topografia e agrimensura' },
        ],
      },
      {
        id: 'isolamento',
        nome: 'Conforto térmico e acústico',
        servicos: [
          { id: 'isolamento-acustico', nome: 'Isolamento acústico' },
          { id: 'isolamento-termico', nome: 'Isolamento térmico' },
        ],
      },
    ],
  },
  {
    id: 'area-externa',
    nome: 'Área externa e lazer',
    descricao: 'Piscinas, jardins e pavimentação',
    categorias: [
      {
        id: 'piscinas',
        nome: 'Piscinas',
        servicos: [
          { id: 'piscina-alvenaria', nome: 'Piscina de alvenaria ou concreto' },
          { id: 'piscina-vinil-fibra', nome: 'Piscina de vinil ou fibra' },
          { id: 'reforma-piscina', nome: 'Reforma e revestimento de piscina', sinonimos: ['borda', 'pastilha'] },
          { id: 'casa-maquinas', nome: 'Casa de máquinas e filtragem' },
          { id: 'aquecimento-piscina', nome: 'Aquecimento de piscina' },
        ],
      },
      {
        id: 'pavimentacao',
        nome: 'Pavimentação',
        servicos: [
          { id: 'calcada', nome: 'Calçadas e passeios' },
          { id: 'garagem-pisos', nome: 'Garagens e pátios' },
          { id: 'asfalto', nome: 'Asfalto e pavimentação' },
        ],
      },
      {
        id: 'paisagismo',
        nome: 'Paisagismo e jardinagem',
        servicos: [
          { id: 'projeto-paisagismo', nome: 'Projeto de paisagismo' },
          { id: 'jardinagem', nome: 'Implantação e manutenção de jardins' },
          { id: 'grama', nome: 'Plantio de grama' },
          { id: 'irrigacao', nome: 'Irrigação' },
        ],
      },
      {
        id: 'lazer',
        nome: 'Lazer',
        servicos: [
          { id: 'churrasqueira', nome: 'Churrasqueira e área gourmet', sinonimos: ['espaço gourmet'] },
          { id: 'lareira', nome: 'Lareira' },
          { id: 'sauna', nome: 'Sauna e spa', sinonimos: ['ofurô', 'banheira'] },
          { id: 'quadras', nome: 'Quadras esportivas' },
        ],
      },
    ],
  },
  {
    id: 'manutencao',
    nome: 'Manutenção e reparos',
    descricao: 'Pequenos serviços e manutenção predial',
    categorias: [
      {
        id: 'reparos-gerais',
        nome: 'Reparos gerais',
        servicos: [
          { id: 'marido-aluguel', nome: 'Marido de aluguel', sinonimos: ['faz-tudo'] },
          { id: 'manutencao-predial', nome: 'Manutenção predial e condomínios' },
          { id: 'chaveiro', nome: 'Chaveiro e fechaduras' },
          { id: 'acessibilidade', nome: 'Adaptações de acessibilidade', sinonimos: ['rampa', 'barra de apoio'] },
        ],
      },
      {
        id: 'limpeza-tecnica',
        nome: 'Limpeza técnica',
        servicos: [
          { id: 'limpeza-fachada', nome: 'Limpeza de fachada e vidros' },
          { id: 'hidrojateamento', nome: 'Hidrojateamento', sinonimos: ['lavadora de alta pressão'] },
          { id: 'dedetizacao', nome: 'Dedetização e controle de pragas', sinonimos: ['cupim'] },
        ],
      },
    ],
  },
]

// Índices auxiliares ---------------------------------------------------------

export type CaminhoServico = {
  area: AreaServico
  categoria: CategoriaServico
  servico: Servico
}

export const SERVICOS_POR_ID: Record<string, CaminhoServico> = Object.fromEntries(
  AREAS_SERVICO.flatMap((area) =>
    area.categorias.flatMap((categoria) =>
      categoria.servicos.map((servico) => [servico.id, { area, categoria, servico }])
    )
  )
)

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Encontra serviços citados num texto livre (digitado ou ditado por voz).
 * Ex.: "faço porcelanato, fulgê e pintura de fachada" ->
 * ['ceramica-porcelanato', 'fulget', 'pintura-externa'].
 * Casa pelo nome, pelos sinônimos e pelo nome da categoria (que seleciona
 * a categoria inteira só quando nenhum serviço dela casou sozinho).
 */
export function encontrarServicosNoTexto(texto: string): string[] {
  const alvo = ` ${normalizar(texto)} `
  const achados = new Set<string>()
  for (const area of AREAS_SERVICO) {
    for (const categoria of area.categorias) {
      let algumDaCategoria = false
      for (const servico of categoria.servicos) {
        const termos = [servico.nome, ...(servico.sinonimos ?? [])]
          .flatMap((t) => {
            const semParenteses = t.split('(')[0]
            // "Pintura externa e fachada" também casa "pintura externa" e "fachada"
            return [t, semParenteses, ...semParenteses.split(/,| e /)]
          })
          .map(normalizar)
          .filter((t) => t.length >= 4)
        if (termos.some((t) => alvo.includes(` ${t} `) || alvo.includes(` ${t}s `))) {
          achados.add(servico.id)
          algumDaCategoria = true
        }
      }
      if (!algumDaCategoria && alvo.includes(` ${normalizar(categoria.nome)} `)) {
        categoria.servicos.forEach((s) => achados.add(s.id))
      }
    }
  }
  return [...achados]
}

/**
 * Aplica um comando de voz (ou texto) à seleção atual de serviços.
 * Entende trechos de adição e de remoção na mesma frase:
 *   "adiciona pintura externa e tira granilite"
 *   "não faço mais fulget, mas agora faço drywall"
 * Trechos sem verbo de remoção são tratados como adição.
 */
const GATILHOS_REMOCAO = [
  'tira', 'tirar', 'tire', 'remove', 'remover', 'remova', 'exclui', 'excluir',
  'apaga', 'apagar', 'desmarca', 'desmarcar', 'sem', 'nao faco', 'nao faco mais',
  'parei de fazer', 'nao trabalho com',
]
const GATILHOS_ADICAO = [
  'adiciona', 'adicionar', 'adicione', 'coloca', 'colocar', 'inclui', 'incluir',
  'marca', 'marcar', 'faco', 'agora faco', 'tambem faco', 'trabalho com', 'mas',
]

export function aplicarComandoDeVoz(
  selecionados: string[],
  texto: string
): { selecionados: string[]; adicionados: string[]; removidos: string[] } {
  const norm = normalizar(texto)
  // Quebra a frase nos gatilhos, mantendo qual gatilho abriu cada trecho.
  const gatilhos = [...GATILHOS_REMOCAO.map((g) => ({ g, remover: true })), ...GATILHOS_ADICAO.map((g) => ({ g, remover: false }))]
    .sort((a, b) => b.g.length - a.g.length)
  const padrao = new RegExp(`\\b(${gatilhos.map((x) => x.g).join('|')})\\b`, 'g')
  const trechos: { texto: string; remover: boolean }[] = []
  let ultimo = 0
  let removerAtual = false
  for (const m of norm.matchAll(padrao)) {
    trechos.push({ texto: norm.slice(ultimo, m.index), remover: removerAtual })
    removerAtual = gatilhos.find((x) => x.g === m[1])!.remover
    ultimo = (m.index ?? 0) + m[0].length
  }
  trechos.push({ texto: norm.slice(ultimo), remover: removerAtual })

  const resultado = new Set(selecionados)
  const adicionados: string[] = []
  const removidos: string[] = []
  for (const t of trechos) {
    for (const id of encontrarServicosNoTexto(t.texto)) {
      if (t.remover && resultado.delete(id)) removidos.push(id)
      if (!t.remover && !resultado.has(id)) {
        resultado.add(id)
        adicionados.push(id)
      }
    }
  }
  return { selecionados: [...resultado], adicionados, removidos }
}
