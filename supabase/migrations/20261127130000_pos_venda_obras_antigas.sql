-- Pós-venda das obras que já estavam concluídas antes do gatilho existir.
-- O gatilho projetos_pos_venda só dispara quando o status muda para
-- 'completo', então obras completas de antes ficaram sem garantia, pesquisa,
-- avaliação e revisões. gerar_pos_venda pula obra que já tem garantia, então
-- rodar de novo não duplica nada.
-- Como projetos não guarda a data de entrega, as datas contam a partir de
-- hoje (o mesmo que aconteceria marcando a obra como completa agora).

select public.gerar_pos_venda(p.id)
from public.projetos p
where p.status = 'completo'
  and not exists (
    select 1 from public.pos_venda v where v.projeto_id = p.id and v.tipo = 'garantia'
  );
