-- Crowd moderation (Tier B2)
--
-- Adds POI crowd feedback (recommend/caution) and extends the existing generic
-- reports table into a workable moderation queue, then restricts public POI reads
-- to approved rows (the review_status read policy deferred from B1).
--
-- RLS-first: poi_feedback is writable only as yourself; the pois count columns are
-- kept in sync by a SECURITY DEFINER trigger (mirrors bump_counts). RPCs are the
-- app entry points (SECURITY DEFINER, auth.uid()-scoped).

-- 1) POI crowd-feedback counts on pois ------------------------------------
alter table public.pois add column if not exists recommend_count integer not null default 0;
alter table public.pois add column if not exists caution_count   integer not null default 0;

-- 2) poi_feedback: one row per (poi, user); recommend | caution -----------
create table if not exists public.poi_feedback (
  id            uuid primary key default gen_random_uuid(),
  poi_id        uuid not null references public.pois(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('recommend', 'caution')),
  created_at    timestamptz not null default now(),
  unique (poi_id, user_id)
);
create index if not exists poi_feedback_poi_idx on public.poi_feedback (poi_id);

alter table public.poi_feedback enable row level security;
create policy "poi_feedback readable by all"  on public.poi_feedback for select using (true);
create policy "users insert own poi_feedback" on public.poi_feedback for insert with check (user_id = auth.uid());
create policy "users update own poi_feedback" on public.poi_feedback for update using (user_id = auth.uid());
create policy "users delete own poi_feedback" on public.poi_feedback for delete using (user_id = auth.uid());

-- keep pois.recommend_count / caution_count in sync (also on recommend<->caution switch)
create or replace function public.bump_poi_feedback_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.pois set
      recommend_count = recommend_count + (case when new.feedback_type = 'recommend' then 1 else 0 end),
      caution_count   = caution_count   + (case when new.feedback_type = 'caution'   then 1 else 0 end)
     where id = new.poi_id;
  elsif tg_op = 'DELETE' then
    update public.pois set
      recommend_count = recommend_count - (case when old.feedback_type = 'recommend' then 1 else 0 end),
      caution_count   = caution_count   - (case when old.feedback_type = 'caution'   then 1 else 0 end)
     where id = old.poi_id;
  elsif tg_op = 'UPDATE' then
    update public.pois set
      recommend_count = recommend_count
        - (case when old.feedback_type = 'recommend' then 1 else 0 end)
        + (case when new.feedback_type = 'recommend' then 1 else 0 end),
      caution_count = caution_count
        - (case when old.feedback_type = 'caution' then 1 else 0 end)
        + (case when new.feedback_type = 'caution' then 1 else 0 end)
     where id = new.poi_id;
  end if;
  return null;
end; $$;

drop trigger if exists poi_feedback_counts_trg on public.poi_feedback;
create trigger poi_feedback_counts_trg
  after insert or update or delete on public.poi_feedback
  for each row execute function public.bump_poi_feedback_counts();

-- 3) Extend reports into a moderation queue + allow POI targets -----------
alter type public.report_target add value if not exists 'POI';
alter table public.reports add column if not exists status      text not null default 'open';
alter table public.reports add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_status_check') then
    alter table public.reports
      add constraint reports_status_check check (status in ('open', 'resolved', 'dismissed'));
  end if;
end $$;

-- 4) RPCs -----------------------------------------------------------------

-- set_poi_feedback: upsert/clear the caller's feedback; returns fresh counts.
-- p_type: 'recommend' | 'caution' to set, or null to clear.
create or replace function public.set_poi_feedback(p_poi uuid, p_type text)
returns table(recommend_count integer, caution_count integer, my_feedback text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_type is not null and p_type not in ('recommend', 'caution') then
    raise exception 'INVALID_FEEDBACK_TYPE';
  end if;
  if not exists (select 1 from pois where id = p_poi) then
    raise exception 'POI_NOT_FOUND';
  end if;

  if p_type is null then
    delete from poi_feedback where poi_id = p_poi and user_id = auth.uid();
  else
    insert into poi_feedback (poi_id, user_id, feedback_type)
    values (p_poi, auth.uid(), p_type)
    on conflict (poi_id, user_id) do update set feedback_type = excluded.feedback_type;
  end if;

  return query
    select p.recommend_count, p.caution_count,
           (select pf.feedback_type from poi_feedback pf
             where pf.poi_id = p_poi and pf.user_id = auth.uid())
      from pois p where p.id = p_poi;
end; $$;

-- create_report: file a moderation report as the caller (reason required).
create or replace function public.create_report(p_target_type text, p_target uuid, p_reason text)
returns public.reports language plpgsql security definer set search_path = public as $$
declare v_report public.reports;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if char_length(coalesce(p_reason, '')) not between 1 and 1000 then
    raise exception 'INVALID_REASON';
  end if;

  insert into reports (reporter_id, target_type, target_id, reason)
  values (auth.uid(), p_target_type::report_target, p_target, p_reason)
  returning * into v_report;
  return v_report;
end; $$;

grant execute on function
  public.set_poi_feedback(uuid, text),
  public.create_report(text, uuid, text)
to authenticated;

-- 5) Restrict public POI reads to approved (deferred from B1) -------------
drop policy if exists "pois readable by all" on public.pois;
create policy "approved pois readable by all" on public.pois for select using (review_status = 'approved');
