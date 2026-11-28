-- ============================================================================
-- Previsão do tempo no Início: cidade usada para buscar a previsão
-- (Open-Meteo, grátis e sem chave). Pode rodar de novo com segurança.
-- ============================================================================

alter table public.empresas add column if not exists clima_cidade text;
alter table public.empresas add column if not exists clima_uf text;
alter table public.empresas add column if not exists clima_latitude double precision;
alter table public.empresas add column if not exists clima_longitude double precision;

-- As políticas de empresas (dono lê e atualiza a própria linha) já cobrem
-- as colunas novas.
