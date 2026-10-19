-- =====================================================================
-- 002: segurança e integridade dos dados
--  - acesso só para usuários com papel "admin" (app_metadata.role)
--  - funções com search_path fixo (alerta do Security Advisor)
--  - CPF/CNPJ (inclusive CNPJ alfanumérico) e telefone validados no banco
--  - notas fiscais nunca são apagadas em cascata; clientes podem ser arquivados
--  - resumo do painel calculado em SQL, no fuso de Brasília
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções de trigger existentes: search_path fixo
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.obra_endereco_cliente()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.endereco is null or btrim(new.endereco) = '' then
    select c.endereco into new.endereco from public.clientes c where c.id = new.cliente_id;
  end if;
  return new;
end $$;

create or replace function public.nota_valida_obra()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.obra_id is not null and not exists (
    select 1 from public.obras o where o.id = new.obra_id and o.cliente_id = new.cliente_id
  ) then
    raise exception 'A obra informada não pertence ao cliente da nota fiscal';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- CPF / CNPJ numérico ou alfanumérico (IN RFB 2.229/2024)
-- Valor de cada caractere = código ASCII - 48 ("0".."9" -> 0..9, "A" -> 17 ... "Z" -> 42);
-- para CNPJs só com números o resultado é o mesmo do cálculo tradicional.
-- ---------------------------------------------------------------------
create or replace function public.documento_valido(doc text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma int;
  dv1 int;
  dv2 int;
begin
  if doc ~ '^[0-9]{11}$' then
    if doc ~ '^(.)\1{10}$' then return false; end if;
    soma := 0;
    for i in 1..9 loop soma := soma + substr(doc, i, 1)::int * (11 - i); end loop;
    dv1 := (soma * 10) % 11 % 10;
    soma := 0;
    for i in 1..10 loop soma := soma + substr(doc, i, 1)::int * (12 - i); end loop;
    dv2 := (soma * 10) % 11 % 10;
    return dv1 = substr(doc, 10, 1)::int and dv2 = substr(doc, 11, 1)::int;
  end if;

  if doc ~ '^[0-9A-Z]{12}[0-9]{2}$' then
    if doc ~ '^(.)\1{13}$' then return false; end if;
    soma := 0;
    for i in 1..12 loop soma := soma + (ascii(substr(doc, i, 1)) - 48) * pesos1[i]; end loop;
    dv1 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;
    soma := dv1 * pesos2[13];
    for i in 1..12 loop soma := soma + (ascii(substr(doc, i, 1)) - 48) * pesos2[i]; end loop;
    dv2 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;
    return dv1 = substr(doc, 13, 1)::int and dv2 = substr(doc, 14, 1)::int;
  end if;

  return false;
end $$;

-- Clientes: grava CPF/CNPJ sem pontuação (maiúsculo) e telefone só com dígitos
create or replace function public.clientes_normalizar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  new.cpf_cnpj := upper(regexp_replace(coalesce(new.cpf_cnpj, ''), '[^0-9A-Za-z]', '', 'g'));
  new.telefone := nullif(regexp_replace(coalesce(new.telefone, ''), '[^0-9]', '', 'g'), '');
  return new;
end $$;

drop trigger if exists trg_clientes_normalizar on public.clientes;
create trigger trg_clientes_normalizar before insert or update on public.clientes
  for each row execute function public.clientes_normalizar();

-- normaliza os registros existentes antes de criar as regras
update public.clientes set cpf_cnpj = cpf_cnpj, telefone = telefone
where cpf_cnpj ~ '[^0-9A-Z]' or telefone ~ '[^0-9]';

alter table public.clientes drop constraint if exists clientes_cpf_cnpj_valido;
alter table public.clientes add constraint clientes_cpf_cnpj_valido
  check (public.documento_valido(cpf_cnpj));

alter table public.clientes drop constraint if exists clientes_telefone_valido;
alter table public.clientes add constraint clientes_telefone_valido
  check (telefone is null or telefone ~ '^[0-9]{10,11}$');

-- ---------------------------------------------------------------------
-- Notas fiscais precisam ser guardadas: nada de exclusão em cascata
-- ---------------------------------------------------------------------
alter table public.clientes add column if not exists arquivado boolean not null default false;

alter table public.notas_fiscais drop constraint if exists notas_fiscais_cliente_id_fkey;
alter table public.notas_fiscais add constraint notas_fiscais_cliente_id_fkey
  foreign key (cliente_id) references public.clientes(id) on delete restrict;

alter table public.notas_fiscais drop constraint if exists notas_fiscais_obra_id_fkey;
alter table public.notas_fiscais add constraint notas_fiscais_obra_id_fkey
  foreign key (obra_id) references public.obras(id) on delete restrict;

-- índices das chaves estrangeiras created_by (alerta do Performance Advisor)
create index if not exists clientes_created_by_idx on public.clientes(created_by);
create index if not exists obras_created_by_idx    on public.obras(created_by);
create index if not exists notas_created_by_idx    on public.notas_fiscais(created_by);

-- ---------------------------------------------------------------------
-- Acesso: somente usuários com app_metadata.role = 'admin'.
-- app_metadata só pode ser alterado com a chave secreta (nunca pelo próprio usuário).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clientes','obras','notas_fiscais'] loop
    execute format('drop policy if exists "auth_select" on public.%I', t);
    execute format('drop policy if exists "auth_insert" on public.%I', t);
    execute format('drop policy if exists "auth_update" on public.%I', t);
    execute format('drop policy if exists "auth_delete" on public.%I', t);
    execute format('drop policy if exists "admin_total" on public.%I', t);
    execute format($p$create policy "admin_total" on public.%I for all to authenticated
      using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
      with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')$p$, t);
  end loop;
end $$;

drop policy if exists "documentos_select" on storage.objects;
drop policy if exists "documentos_insert" on storage.objects;
drop policy if exists "documentos_update" on storage.objects;
drop policy if exists "documentos_delete" on storage.objects;
drop policy if exists "documentos_admin"  on storage.objects;

create policy "documentos_admin" on storage.objects for all to authenticated
  using (bucket_id = 'documentos'
         and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'documentos'
              and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
              and (storage.foldername(name))[1] in ('clientes', 'obras', 'notas-fiscais', 'geral'));

-- ---------------------------------------------------------------------
-- Resumo do painel: somas no banco (sem o limite de 1000 linhas por consulta)
-- e "hoje" no fuso de Brasília. Roda com as permissões de quem chama (RLS vale).
-- ---------------------------------------------------------------------
create or replace function public.resumo_dashboard()
returns json language sql stable set search_path = '' as $$
  with base as (
    select (now() at time zone 'America/Sao_Paulo')::date as hoje
  ),
  meses as (
    select to_char(date_trunc('month', b.hoje::timestamp) - make_interval(months => g), 'YYYY-MM') as mes
    from base b, generate_series(5, 0, -1) as g
  ),
  fat as (
    select to_char(n.data_emissao::timestamp, 'YYYY-MM') as mes, sum(n.valor_total) as valor
    from public.notas_fiscais n
    group by 1
  )
  select json_build_object(
    'hoje',              b.hoje,
    'totalClientes',     (select count(*) from public.clientes c where not c.arquivado),
    'totalObras',        (select count(*) from public.obras),
    'obrasAndamento',    (select count(*) from public.obras o
                           where o.data_inicio <= b.hoje
                             and (o.previsao_termino is null or o.previsao_termino >= b.hoje)),
    'obrasPrazoVencido', (select count(*) from public.obras o where o.previsao_termino < b.hoje),
    'obrasFuturas',      (select count(*) from public.obras o where o.data_inicio > b.hoje),
    'totalNotas',        (select count(*) from public.notas_fiscais),
    'faturamentoTotal',  (select coalesce(sum(n.valor_total), 0) from public.notas_fiscais n),
    'faturamentoPorMes', (select json_agg(json_build_object('mes', m.mes, 'valor', coalesce(f.valor, 0)) order by m.mes)
                           from meses m left join fat f on f.mes = m.mes)
  )
  from base b;
$$;

revoke execute on function public.resumo_dashboard() from public, anon;
grant execute on function public.resumo_dashboard() to authenticated;
