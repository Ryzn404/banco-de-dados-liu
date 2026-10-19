-- =====================================================================
-- Schema: Clientes, Obras, Notas Fiscais + RLS + Realtime + Storage
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (btrim(nome) <> ''),
  cpf_cnpj    text not null unique,
  telefone    text,
  endereco    text,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.obras (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes(id) on delete cascade,
  endereco          text,
  data_inicio       date not null,
  previsao_termino  date,
  servicos          text,
  created_by        uuid default auth.uid() references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint obras_datas_chk check (previsao_termino is null or previsao_termino >= data_inicio)
);

create table if not exists public.notas_fiscais (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  obra_id       uuid references public.obras(id) on delete set null,
  numero        text not null unique,
  data_emissao  date not null,
  valor_total   numeric(14,2) not null check (valor_total >= 0),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists obras_cliente_idx        on public.obras(cliente_id);
create index if not exists notas_cliente_idx        on public.notas_fiscais(cliente_id);
create index if not exists notas_obra_idx           on public.notas_fiscais(obra_id);
create index if not exists notas_data_emissao_idx   on public.notas_fiscais(data_emissao);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Obra: se o endereço vier vazio, usa o endereço do cliente
create or replace function public.obra_endereco_cliente()
returns trigger language plpgsql as $$
begin
  if new.endereco is null or btrim(new.endereco) = '' then
    select c.endereco into new.endereco from public.clientes c where c.id = new.cliente_id;
  end if;
  return new;
end $$;

-- Nota fiscal: a obra (se informada) precisa pertencer ao mesmo cliente
create or replace function public.nota_valida_obra()
returns trigger language plpgsql as $$
begin
  if new.obra_id is not null and not exists (
    select 1 from public.obras o where o.id = new.obra_id and o.cliente_id = new.cliente_id
  ) then
    raise exception 'A obra informada não pertence ao cliente da nota fiscal';
  end if;
  return new;
end $$;

drop trigger if exists trg_clientes_updated on public.clientes;
create trigger trg_clientes_updated before update on public.clientes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_obras_updated on public.obras;
create trigger trg_obras_updated before update on public.obras
  for each row execute function public.set_updated_at();

drop trigger if exists trg_notas_updated on public.notas_fiscais;
create trigger trg_notas_updated before update on public.notas_fiscais
  for each row execute function public.set_updated_at();

drop trigger if exists trg_obras_endereco on public.obras;
create trigger trg_obras_endereco before insert or update on public.obras
  for each row execute function public.obra_endereco_cliente();

drop trigger if exists trg_notas_obra on public.notas_fiscais;
create trigger trg_notas_obra before insert or update on public.notas_fiscais
  for each row execute function public.nota_valida_obra();

-- ---------------------------------------------------------------------
-- Row Level Security: apenas usuários autenticados
-- ---------------------------------------------------------------------
alter table public.clientes      enable row level security;
alter table public.obras         enable row level security;
alter table public.notas_fiscais enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clientes','obras','notas_fiscais'] loop
    execute format('drop policy if exists "auth_select" on public.%I', t);
    execute format('drop policy if exists "auth_insert" on public.%I', t);
    execute format('drop policy if exists "auth_update" on public.%I', t);
    execute format('drop policy if exists "auth_delete" on public.%I', t);
    execute format('create policy "auth_select" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "auth_insert" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "auth_update" on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "auth_delete" on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
alter table public.clientes      replica identity full;
alter table public.obras         replica identity full;
alter table public.notas_fiscais replica identity full;

do $$
declare t text;
begin
  foreach t in array array['clientes','obras','notas_fiscais'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Storage: bucket privado "documentos", organizado por pastas
--   clientes/<cliente_id>/...
--   obras/<obra_id>/...
--   notas-fiscais/<nota_id>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "documentos_select" on storage.objects;
drop policy if exists "documentos_insert" on storage.objects;
drop policy if exists "documentos_update" on storage.objects;
drop policy if exists "documentos_delete" on storage.objects;

create policy "documentos_select" on storage.objects for select to authenticated
  using (bucket_id = 'documentos');
create policy "documentos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos'
              and (storage.foldername(name))[1] in ('clientes','obras','notas-fiscais','geral'));
create policy "documentos_update" on storage.objects for update to authenticated
  using (bucket_id = 'documentos');
create policy "documentos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos');
