-- ===========================================
-- TRAVEL MAP — Supabase Schema
-- Copiez-collez ce fichier entier dans
-- Supabase > SQL Editor > New Query
-- ===========================================

create extension if not exists "uuid-ossp";

-- ─── compte_agent ────────────────────────
create table if not exists compte_agent (
  id         uuid default uuid_generate_v4() primary key,
  pin_hash   text not null,
  logo_url   text,
  created_at timestamp with time zone default now()
);

-- ─── voyages ─────────────────────────────
create table if not exists voyages (
  id               uuid default uuid_generate_v4() primary key,
  compte_agent_id  uuid references compte_agent(id) on delete cascade,
  nom              text not null,
  nom_client       text,
  destination      text,
  date_debut       date,
  date_fin         date,
  lien_uuid        uuid default uuid_generate_v4() unique not null,
  logo_url         text,
  created_at       timestamp with time zone default now()
);

-- ─── regions ─────────────────────────────
create table if not exists regions (
  id         uuid default uuid_generate_v4() primary key,
  voyage_id  uuid references voyages(id) on delete cascade,
  nom        text not null,
  couleur    text not null default '#3B82F6'
);

-- ─── etapes ──────────────────────────────
create table if not exists etapes (
  id                      uuid default uuid_generate_v4() primary key,
  voyage_id               uuid references voyages(id) on delete cascade,
  ordre                   integer not null default 0,
  nom                     text not null,
  lieu_label              text,
  lat                     float8,
  lng                     float8,
  date_debut              date,
  date_fin                date,
  description             text,
  type_transport          text default 'voiture',
  notes_trajet            text,
  region_id               uuid references regions(id) on delete set null,
  duree_vers_suivante     integer,
  distance_vers_suivante  float8,
  polyline_vers_suivante  text,
  created_at              timestamp with time zone default now()
);

-- ─── photos ──────────────────────────────
create table if not exists photos (
  id         uuid default uuid_generate_v4() primary key,
  etape_id   uuid references etapes(id) on delete cascade,
  url        text not null,
  ordre      integer not null default 0,
  created_at timestamp with time zone default now()
);

-- ─── RLS : accès libre pour la clé anon ──
alter table compte_agent enable row level security;
alter table voyages      enable row level security;
alter table regions      enable row level security;
alter table etapes       enable row level security;
alter table photos       enable row level security;

create policy "anon_all" on compte_agent for all using (true) with check (true);
create policy "anon_all" on voyages      for all using (true) with check (true);
create policy "anon_all" on regions      for all using (true) with check (true);
create policy "anon_all" on etapes       for all using (true) with check (true);
create policy "anon_all" on photos       for all using (true) with check (true);

-- ─── Storage bucket pour les photos ──────
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');

create policy "photos_anon_insert" on storage.objects
  for insert with check (bucket_id = 'photos');

create policy "photos_anon_delete" on storage.objects
  for delete using (bucket_id = 'photos');
