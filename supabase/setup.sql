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
