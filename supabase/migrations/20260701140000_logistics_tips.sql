-- 20260701140000_logistics_tips.sql
-- Phase 7.2: logistics guide board — community upvotes for logistics_tips.
-- The table itself already exists (init schema §6: id, author_id, category,
-- title, body, region, upvotes). This migration adds a per-user vote table, a
-- trigger that keeps logistics_tips.upvotes in sync, and an idempotent toggle
-- RPC. Mirrors the likes / bump_counts pattern used for routes.

-- Per-user vote (at most one per tip)
create table if not exists public.logistics_tip_votes (
  tip_id     uuid not null references public.logistics_tips(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tip_id, user_id)
);
alter table public.logistics_tip_votes enable row level security;
-- Users only need to read their own vote state; the public count lives on
-- logistics_tips.upvotes (denormalized by the trigger below).
create policy "users read own tip votes"
  on public.logistics_tip_votes for select using (user_id = auth.uid());
-- Writes go exclusively through the toggle_tip_upvote RPC.

-- Keep logistics_tips.upvotes in sync with the vote rows.
create or replace function public.bump_tip_upvotes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.logistics_tips
     set upvotes = greatest(0, upvotes + (case when tg_op = 'INSERT' then 1 else -1 end))
   where id = coalesce(new.tip_id, old.tip_id);
  return null;
end; $$;

drop trigger if exists tip_upvotes_trg on public.logistics_tip_votes;
create trigger tip_upvotes_trg
  after insert or delete on public.logistics_tip_votes
  for each row execute function public.bump_tip_upvotes();

-- Idempotent toggle: returns true if the tip is now upvoted, false if cleared.
create or replace function public.toggle_tip_upvote(p_tip uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select true into v_exists
    from public.logistics_tip_votes
   where tip_id = p_tip and user_id = v_uid;

  if v_exists then
    delete from public.logistics_tip_votes
     where tip_id = p_tip and user_id = v_uid;
    return false;
  else
    insert into public.logistics_tip_votes (tip_id, user_id)
    values (p_tip, v_uid);
    return true;
  end if;
end; $$;

grant select on public.logistics_tip_votes to anon, authenticated;
grant execute on function public.toggle_tip_upvote(uuid) to authenticated;
