import Link from "next/link";
import {
  FolderKanbanIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlusIcon,
} from "lucide-react";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarTelefone } from "./telefone";
import {
  ClienteLinhaDoTempo,
  type EventoCliente,
} from "./cliente-linha-do-tempo";
import { ClienteRelacionamento } from "./cliente-relacionamento";
import { RegistrarAtividade } from "./registrar-atividade";
import { NegociosCliente } from "@/components/negocios/negocios-cliente";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  iniciais,
} from "@/lib/formato";
import {
  faseDoCliente,
  faseAutomatica,
  linkWhatsApp,
  numerosDoCliente,
  situacaoFollowup,
} from "@/lib/crm";
import {
  VARIANTE_FASE_CLIENTE,
  VARIANTE_STATUS_PROJETO,
  VARIANTE_TEMPERATURA,
  projetoAtrasado,
} from "@/lib/status";
import {
  FASE_CLIENTE_LABEL,
  STATUS_PROJETO_LABEL,
  TEMPERATURA_LABEL,
  TIPO_ATIVIDADE_LABEL,
  type Atividade,
  type Cliente,
  type MembroEquipe,
  type Negocio,
  type Projeto,
} from "@/types";

function Dado({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm break-words">{valor || "—"}</dd>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <FramePanel className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span
        className={`truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl ${alerta ? "text-destructive" : ""}`}
      >
        {valor}
      </span>
      {detalhe && (
        <span className="text-xs text-muted-foreground">{detalhe}</span>
      )}
    </FramePanel>
  );
}

function ListaObras({
  obras,
  novoProjeto,
  compacta,
}: {
  obras: Projeto[];
  novoProjeto: string;
  /** Coluna estreita: barra e status descem para baixo do nome. */
  compacta?: boolean;
}) {
  if (obras.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanbanIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhuma obra ainda</EmptyTitle>
          <EmptyDescription>
            Abra a primeira obra deste cliente.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href={novoProjeto} />}>
            <PlusIcon data-icon="inline-start" />
            Novo projeto
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <ItemGroup>
      {obras.map((p) => {
        const atrasado = projetoAtrasado(p);
        return (
          <Item key={p.id} render={<Link href={`/projetos/${p.id}`} />}>
            <ItemContent
              className={compacta ? "min-w-0 basis-full" : "min-w-0"}
            >
              <ItemTitle className="truncate">{p.nome}</ItemTitle>
              <ItemDescription className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                {atrasado && (
                  <Badge variant="destructive-light">Atrasado</Badge>
                )}
                <span>Prazo {formatarData(p.data_prazo)}</span>
                {p.orcamento_total ? (
                  <>
                    <span
                      aria-hidden
                      className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                    />
                    <span>{formatarMoeda(p.orcamento_total)}</span>
                  </>
                ) : null}
              </ItemDescription>
            </ItemContent>
            <ItemActions
              className={compacta ? "w-full gap-3" : "w-full gap-3 sm:w-56"}
            >
              <Progress
                value={p.percentual_conclusao}
                aria-label={`Conclusão de ${p.nome}`}
                className="flex-1 flex-nowrap items-center"
              >
                <span className="text-muted-foreground order-last w-9 shrink-0 text-end text-xs tabular-nums">
                  {p.percentual_conclusao}%
                </span>
              </Progress>
              <Badge variant={VARIANTE_STATUS_PROJETO[p.status]}>
                {STATUS_PROJETO_LABEL[p.status]}
              </Badge>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}

type Props = {
  cliente: Cliente;
  obras: Projeto[];
  atividades: Atividade[];
  equipe: Pick<MembroEquipe, "id" | "nome">[];
  /** false antes de rodar o SQL do Cliente 360 (colunas e tabela novas). */
  crmDisponivel: boolean;
  /** 'YYYY-MM-DD' calculado no servidor. */
  hoje: string;
  /** null antes de rodar o SQL do funil. */
  negocios: Negocio[] | null;
  agora: number;
};

// Painel do cliente (Cliente 360): cabeçalho com fase e ações, números,
// e abas Resumo (linha do tempo + obras), Obras e Dados.
export function ClientePainel({
  cliente: c,
  obras: todasObras,
  atividades,
  equipe,
  crmDisponivel,
  hoje,
  negocios,
  agora,
}: Props) {
  // Obras canceladas (proposta perdida) ficam só no histórico do negócio.
  const obras = todasObras.filter((o) => o.status !== "cancelado");
  const fase = faseDoCliente(
    { fase_manual: c.fase_manual ?? null },
    obras,
    negocios ?? [],
  );
  const numeros = numerosDoCliente(obras);
  const followup = situacaoFollowup(c.proximo_followup_em ?? null, hoje);
  const ultimoContato = atividades[0]?.ocorreu_em ?? null;
  const whatsapp = linkWhatsApp(c.telefone);
  const novoProjeto = `/projetos/novo?clienteId=${c.id}`;
  const responsavel = equipe.find((m) => m.id === c.responsavel_id);

  const eventos: EventoCliente[] = [
    ...atividades.map((a) => ({
      id: `a-${a.id}`,
      quando: a.ocorreu_em,
      tipo: a.tipo,
      titulo: a.equipe?.nome
        ? `${TIPO_ATIVIDADE_LABEL[a.tipo]} · ${a.equipe.nome}`
        : TIPO_ATIVIDADE_LABEL[a.tipo],
      texto: a.texto,
    })),
    ...obras.map((p) => ({
      id: `p-${p.id}`,
      quando: p.created_at,
      tipo: "obra" as const,
      titulo: `Obra aberta: ${p.nome}`,
      texto: p.orcamento_total
        ? `Orçamento de ${formatarMoeda(p.orcamento_total)}`
        : undefined,
      href: `/projetos/${p.id}`,
    })),
    {
      id: "cadastro",
      quando: c.created_at,
      tipo: "cadastro" as const,
      titulo: "Cliente cadastrado",
    },
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {c.nome}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={VARIANTE_FASE_CLIENTE[fase]}>
                {FASE_CLIENTE_LABEL[fase]}
              </Badge>
              {c.temperatura && (
                <Badge variant={VARIANTE_TEMPERATURA[c.temperatura]}>
                  {TEMPERATURA_LABEL[c.temperatura]}
                </Badge>
              )}
              <Badge variant="outline">{c.tipo}</Badge>
              {responsavel && (
                <span className="text-xs text-muted-foreground">
                  Responsável: {responsavel.nome}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsapp && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={whatsapp} target="_blank" rel="noreferrer" />}
            >
              <MessageCircleIcon data-icon="inline-start" />
              WhatsApp
            </Button>
          )}
          {c.telefone && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`tel:${c.telefone}`} />}
            >
              <PhoneIcon data-icon="inline-start" />
              Ligar
            </Button>
          )}
          <Button nativeButton={false} render={<Link href={novoProjeto} />}>
            <PlusIcon data-icon="inline-start" />
            Novo projeto
          </Button>
        </div>
      </header>

      <Frame spacing="default" className="grid grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Contratado"
          valor={formatarMoeda(numeros.contratado)}
          detalhe={`${numeros.totalObras} ${numeros.totalObras === 1 ? "obra" : "obras"} no total`}
        />
        <Numero
          rotulo="Em proposta"
          valor={formatarMoeda(numeros.emProposta)}
          detalhe="Obras em planejamento"
        />
        <Numero
          rotulo="Obras ativas"
          valor={String(numeros.obrasAtivas)}
          detalhe="Em execução ou pausadas"
        />
        <Numero
          rotulo="Próximo follow-up"
          valor={
            followup === "sem"
              ? "Sem data"
              : followup === "hoje"
                ? "Hoje"
                : formatarData(c.proximo_followup_em)
          }
          detalhe={
            followup === "atrasado"
              ? "Atrasado"
              : ultimoContato
                ? `Último contato ${formatarDataHora(ultimoContato)}`
                : "Nenhum contato registrado"
          }
          alerta={followup === "atrasado"}
        />
      </Frame>

      <Tabs defaultValue="resumo" className="gap-4">
        <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            {negocios && (
              <TabsTrigger value="negocios">
                Negócios
                <span className="text-xs text-muted-foreground tabular-nums">
                  {negocios.length}
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger value="obras">
              Obras
              <span className="text-xs text-muted-foreground tabular-nums">
                {obras.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="dados">Dados</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumo">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Frame spacing="default" className="min-w-0">
              <FrameHeader>
                <FrameTitle>Linha do tempo</FrameTitle>
                <FrameDescription>
                  Contatos, obras e mudanças deste cliente
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-6">
                <RegistrarAtividade
                  clienteId={c.id}
                  empresaId={c.empresa_id}
                  disponivel={crmDisponivel}
                />
                <Separator />
                <ClienteLinhaDoTempo eventos={eventos} />
              </FramePanel>
            </Frame>

            <div className="flex min-w-0 flex-col gap-6 self-start">
              {negocios && (
                <Frame spacing="default" className="min-w-0">
                  <FrameHeader>
                    <FrameTitle>Negócios abertos</FrameTitle>
                    <FrameDescription>No funil agora</FrameDescription>
                  </FrameHeader>
                  <FramePanel>
                    <NegociosCliente
                      negocios={negocios}
                      empresaId={c.empresa_id}
                      clienteId={c.id}
                      equipe={equipe}
                      agora={agora}
                      compacta
                    />
                  </FramePanel>
                </Frame>
              )}
              <Frame spacing="default" className="min-w-0">
                <FrameHeader>
                  <FrameTitle>Obras</FrameTitle>
                  <FrameDescription>
                    {obras.length === 1 ? "1 obra" : `${obras.length} obras`}{" "}
                    deste cliente
                  </FrameDescription>
                </FrameHeader>
                <FramePanel>
                  <ListaObras
                    obras={obras.slice(0, 4)}
                    novoProjeto={novoProjeto}
                    compacta
                  />
                </FramePanel>
              </Frame>
            </div>
          </div>
        </TabsContent>

        {negocios && (
          <TabsContent value="negocios">
            <Frame spacing="default" className="min-w-0">
              <FramePanel>
                <NegociosCliente
                  negocios={negocios}
                  empresaId={c.empresa_id}
                  clienteId={c.id}
                  equipe={equipe}
                  agora={agora}
                />
              </FramePanel>
            </Frame>
          </TabsContent>
        )}

        <TabsContent value="obras">
          <Frame spacing="default" className="min-w-0">
            <FramePanel>
              <ListaObras obras={obras} novoProjeto={novoProjeto} />
            </FramePanel>
          </Frame>
        </TabsContent>

        <TabsContent value="dados">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Frame spacing="default" className="min-w-0">
              <FrameHeader>
                <FrameTitle>Relacionamento</FrameTitle>
                <FrameDescription>
                  Fase, temperatura, origem e próximo contato
                </FrameDescription>
              </FrameHeader>
              <FramePanel>
                <ClienteRelacionamento
                  cliente={c}
                  faseCalculada={faseAutomatica(obras, negocios ?? [])}
                  equipe={equipe}
                  disponivel={crmDisponivel}
                />
              </FramePanel>
            </Frame>

            <Frame spacing="default" className="min-w-0 self-start">
              <FrameHeader>
                <FrameTitle>Cadastro</FrameTitle>
              </FrameHeader>
              <FramePanel>
                <dl className="flex flex-col gap-4">
                  {c.tipo === "PJ" && (
                    <Dado rotulo="Razão social" valor={c.razao_social} />
                  )}
                  <Dado
                    rotulo={c.tipo === "PF" ? "CPF" : "CNPJ"}
                    valor={c.tipo === "PF" ? c.cpf : c.cnpj}
                  />
                  <Dado
                    rotulo="Telefone"
                    valor={formatarTelefone(c.telefone)}
                  />
                  <Dado rotulo="E-mail" valor={c.email} />
                  <Dado rotulo="Endereço" valor={c.endereco} />
                  <Dado rotulo="Origem" valor={c.origem} />
                  <Dado
                    rotulo="Cliente desde"
                    valor={formatarDataHora(c.created_at)}
                  />
                </dl>
              </FramePanel>
            </Frame>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
