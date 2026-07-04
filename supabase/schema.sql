create extension if not exists "uuid-ossp";

-- CardMania V6 production schema.
-- Run this in Supabase SQL Editor.

create table if not exists public.collection_cards (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  image text,
  back_image text,
  player text,
  team text,
  manufacturer text,
  league text,
  country text,
  set_name text,
  year text,
  parallel text,
  serial_number text,
  card_number text,
  grade text,
  condition text,
  notes text,
  purchase_price numeric default 0,
  estimated_value numeric default 0,
  confidence numeric default 0,
  source text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.collection_cards enable row level security;

drop policy if exists "Users can read own collection cards" on public.collection_cards;
drop policy if exists "Users can insert own collection cards" on public.collection_cards;
drop policy if exists "Users can update own collection cards" on public.collection_cards;
drop policy if exists "Users can delete own collection cards" on public.collection_cards;

create policy "Users can read own collection cards" on public.collection_cards
for select using (auth.uid() = user_id);

create policy "Users can insert own collection cards" on public.collection_cards
for insert with check (auth.uid() = user_id);

create policy "Users can update own collection cards" on public.collection_cards
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own collection cards" on public.collection_cards
for delete using (auth.uid() = user_id);

create index if not exists collection_cards_user_created_idx
on public.collection_cards (user_id, created_at desc);

create index if not exists collection_cards_user_player_idx
on public.collection_cards (user_id, player);

-- Storage bucket for card images.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload own card images" on storage.objects;
drop policy if exists "Users can read card images" on storage.objects;
drop policy if exists "Users can update own card images" on storage.objects;
drop policy if exists "Users can delete own card images" on storage.objects;

create policy "Users can upload own card images" on storage.objects
for insert with check (
  bucket_id = 'card-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can read card images" on storage.objects
for select using (bucket_id = 'card-images');

create policy "Users can update own card images" on storage.objects
for update using (
  bucket_id = 'card-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete own card images" on storage.objects
for delete using (
  bucket_id = 'card-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
