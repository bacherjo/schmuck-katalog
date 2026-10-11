-- Jewellery Catalogue: Supabase setup
-- Paste this whole file into Supabase > SQL Editor > New query, then press "Run".
-- Running it twice is safe.

-- 1. Table for the pieces ----------------------------------------------------
create table if not exists public.pieces (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default '',
  beschreibung      text not null default '',
  steine            text not null default '',
  gold              text not null default '',
  gold_preis        numeric(12,2),
  fasser            text not null default '',
  fasser_preis      numeric(12,2),
  druck             text not null default '',
  druck_preis       numeric(12,2),
  willi             text not null default '',
  willi_preis       numeric(12,2),
  arbeitszeit       text not null default '',
  arbeitszeit_preis numeric(12,2),
  verkaufspreis     numeric(12,2),
  kommentar         text not null default '',
  photos            text[] not null default '{}',
  import_key        text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 1b. Automatic piece number (1000, 1001, ...), assigned by the database
alter table public.pieces
  add column if not exists nummer integer generated always as identity (start with 1000) unique;

-- 1c. Preis next to Steine (added later)
alter table public.pieces add column if not exists steine_preis numeric(12,2);

-- 1d. Silber + Preis (added later)
alter table public.pieces add column if not exists silber text not null default '';
alter table public.pieces add column if not exists silber_preis numeric(12,2);

-- 2. Table for settings (workshop name on the PDFs) --------------------------
create table if not exists public.settings (
  id       int primary key default 1 check (id = 1),
  workshop text not null default ''
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 3. Security: only signed-in users can read or change anything ---------------
alter table public.pieces   enable row level security;
alter table public.settings enable row level security;

drop policy if exists "signed-in users manage pieces" on public.pieces;
create policy "signed-in users manage pieces" on public.pieces
  for all to authenticated using (true) with check (true);

drop policy if exists "signed-in users manage settings" on public.settings;
create policy "signed-in users manage settings" on public.settings
  for all to authenticated using (true) with check (true);

-- 4. Private storage for the photos ------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "signed-in users read photos" on storage.objects;
create policy "signed-in users read photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');

drop policy if exists "signed-in users add photos" on storage.objects;
create policy "signed-in users add photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "signed-in users change photos" on storage.objects;
create policy "signed-in users change photos" on storage.objects
  for update to authenticated using (bucket_id = 'photos');

drop policy if exists "signed-in users delete photos" on storage.objects;
create policy "signed-in users delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- 5. Share links ("Stück per E-Mail senden") ----------------------------------
-- Each piece can get a secret token. stueck.html?t=<token> shows only
-- number, name, Beschreibung and photos. Costs and Kommentar are never shown.
alter table public.pieces add column if not exists share_token uuid unique;

create or replace function public.public_piece(token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('nummer', nummer, 'name', name, 'beschreibung', beschreibung, 'photos', photos)
  from public.pieces where token is not null and share_token = token;
$$;
revoke all on function public.public_piece(uuid) from public;
grant execute on function public.public_piece(uuid) to anon, authenticated;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_shared_photo(path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pieces where share_token is not null and path = any(photos));
$$;
revoke all on function private.is_shared_photo(text) from public;
grant execute on function private.is_shared_photo(text) to anon, authenticated;

drop policy if exists "visitors read photos of shared pieces" on storage.objects;
create policy "visitors read photos of shared pieces" on storage.objects
  for select to anon using (bucket_id = 'photos' and private.is_shared_photo(name));
