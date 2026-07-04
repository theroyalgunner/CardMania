-- Optional standalone storage setup for Supabase.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do update set public = true;
