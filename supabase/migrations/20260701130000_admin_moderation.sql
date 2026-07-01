-- Moderation admin (Tier C3)
--
-- Operationalizes the B2 moderation data: an admin can approve/reject pending
-- POIs and resolve/dismiss reports. Read queues bypass the public RLS via
-- SECURITY DEFINER RPCs.
--
-- SECURITY: admin status lives in a separate admin_users table with deny-all RLS
-- (NOT a profiles column) — profiles has a "update own profile" policy, so an
-- is_admin column there would let any user self-escalate. admin_users is written
-- only out-of-band (service_role / SQL), never by app users.

-- 1) admin_users: who can moderate ---------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- No policies: deny-all for anon/authenticated. Only definer functions (running
-- as owner) and service_role touch this table.

-- 2) is_admin(): does the caller moderate? (definer → bypasses admin_users RLS)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- 3) Admin write RPCs (self-gated via is_admin) --------------------------

-- review_poi: approve / reject / re-queue a POI.
create or replace function public.review_poi(p_poi uuid, p_status text)
returns public.pois language plpgsql security definer set search_path = public as $$
declare v_poi public.pois;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('approved', 'pending', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;
  update pois set review_status = p_status where id = p_poi returning * into v_poi;
  if v_poi.id is null then raise exception 'POI_NOT_FOUND'; end if;
  return v_poi;
end; $$;

-- resolve_report: close a report as resolved or dismissed.
create or replace function public.resolve_report(p_report uuid, p_status text)
returns public.reports language plpgsql security definer set search_path = public as $$
declare v_report public.reports;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'INVALID_STATUS';
  end if;
  update reports set status = p_status, resolved_at = now()
   where id = p_report returning * into v_report;
  if v_report.id is null then raise exception 'REPORT_NOT_FOUND'; end if;
  return v_report;
end; $$;

-- 4) Admin read queues (definer → see rows the public RLS hides) ----------

-- pending POIs awaiting review (the approved-only public policy hides these).
create or replace function public.admin_list_pending_pois()
returns setof public.pois language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  return query select * from pois where review_status = 'pending' order by source_updated_at desc nulls last;
end; $$;

-- open reports awaiting triage.
create or replace function public.admin_list_open_reports()
returns setof public.reports language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  return query select * from reports where status = 'open' order by created_at asc;
end; $$;

grant execute on function
  public.review_poi(uuid, text),
  public.resolve_report(uuid, text),
  public.admin_list_pending_pois(),
  public.admin_list_open_reports()
to authenticated;
