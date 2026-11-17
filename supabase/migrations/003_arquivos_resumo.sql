-- =====================================================================
-- 003: resumo dos arquivos para a tela Arquivos (contagem por pasta e
-- últimos envios). Roda com as permissões de quem chama (RLS do Storage vale).
-- =====================================================================
create or replace function public.arquivos_resumo()
returns json language sql stable set search_path = '' as $$
  select json_build_object(
    'pastas', coalesce((
      select json_object_agg(s.pasta, s.total)
      from (
        select split_part(o.name, '/', 1) as pasta, count(*) as total
        from storage.objects o
        where o.bucket_id = 'documentos' and o.name !~ '\.emptyFolderPlaceholder$'
        group by 1
      ) s), '{}'::json),
    'recentes', coalesce((
      select json_agg(r)
      from (
        select o.name, o.created_at, (o.metadata ->> 'size')::bigint as tamanho, o.metadata ->> 'mimetype' as tipo
        from storage.objects o
        where o.bucket_id = 'documentos' and o.name !~ '\.emptyFolderPlaceholder$'
        order by o.created_at desc
        limit 8
      ) r), '[]'::json)
  );
$$;

revoke execute on function public.arquivos_resumo() from public, anon;
grant execute on function public.arquivos_resumo() to authenticated;
