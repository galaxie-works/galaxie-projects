-- Equipe: cadastro completo da pessoa (foto, contatos, endereço, dados de trabalho).
-- Só nome e profissão são obrigatórios na tela; aqui tudo é opcional para não
-- quebrar os cadastros antigos. "funcao" é a profissão e "telefone" é o
-- telefone profissional (colunas que já existiam).
-- A foto fica no bucket privado "arquivos", em <empresa_id>/equipe/<id>/...,
-- coberta pela policy "arquivos_storage_own" (primeira pasta = empresa).
-- Pode rodar de novo com segurança.

alter table public.equipe add column if not exists foto_caminho text;
alter table public.equipe add column if not exists telefone_pessoal text;
alter table public.equipe add column if not exists email text;
alter table public.equipe add column if not exists cpf text;
alter table public.equipe add column if not exists data_nascimento date;
alter table public.equipe add column if not exists cep text;
alter table public.equipe add column if not exists endereco text;
alter table public.equipe add column if not exists bairro text;
alter table public.equipe add column if not exists cidade text;
alter table public.equipe add column if not exists uf text;
alter table public.equipe add column if not exists vinculo text;
alter table public.equipe add column if not exists valor_diaria numeric(14, 2);
alter table public.equipe add column if not exists chave_pix text;
alter table public.equipe add column if not exists data_inicio date;
alter table public.equipe add column if not exists contato_emergencia_nome text;
alter table public.equipe add column if not exists contato_emergencia_telefone text;
alter table public.equipe add column if not exists observacoes text;

alter table public.equipe drop constraint if exists equipe_vinculo_check;
alter table public.equipe add constraint equipe_vinculo_check
  check (vinculo is null or vinculo in ('clt', 'autonomo', 'mei', 'empreiteiro', 'diarista', 'socio', 'outro'));

alter table public.equipe drop constraint if exists equipe_valor_diaria_check;
alter table public.equipe add constraint equipe_valor_diaria_check
  check (valor_diaria is null or valor_diaria >= 0);
