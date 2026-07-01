-- POI provenance + logistics (Tier B1)
--
-- The pois table already carries basic provenance: source, source_ref (unique
-- with source), source_updated_at, and a meta jsonb. This migration ADDS the
-- licensing/attribution fields and the bike-logistics fields the app wants to
-- display, WITHOUT touching the existing columns or the (source, source_ref)
-- upsert key. All additions are nullable or defaulted, so existing rows and any
-- current inserts stay valid.
--
-- review_status defaults to 'approved' so nothing is hidden by adding the column;
-- the moderation read policy (only show approved) is deliberately left to B2.

-- Provenance / licensing --------------------------------------------------
alter table public.pois add column if not exists source_url   text;
alter table public.pois add column if not exists source_name  text;
alter table public.pois add column if not exists license_type text;
alter table public.pois add column if not exists attribution  text;
alter table public.pois add column if not exists review_status text not null default 'approved';

-- Constrain review_status to a known set (guarded so re-runs are safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pois_review_status_check'
  ) then
    alter table public.pois
      add constraint pois_review_status_check
      check (review_status in ('approved', 'pending', 'rejected'));
  end if;
end $$;

create index if not exists pois_review_status_idx on public.pois (review_status);

-- Bike logistics (shown on POI detail) ------------------------------------
alter table public.pois add column if not exists transport_mode  text;   -- e.g. 'train','bus','ferry'
alter table public.pois add column if not exists bike_policy      text;   -- ko: how bikes are handled
alter table public.pois add column if not exists bike_policy_en   text;   -- en translation
alter table public.pois add column if not exists packing_required boolean; -- must the bike be bagged/boxed?
alter table public.pois add column if not exists packing_notes    text;   -- ko notes
alter table public.pois add column if not exists packing_notes_en text;   -- en notes
alter table public.pois add column if not exists booking_url      text;   -- reservation link

comment on column public.pois.license_type  is 'Data license of this POI record (e.g. KOGL-1, CC-BY, proprietary).';
comment on column public.pois.attribution   is 'Human-readable attribution string to display when required by the license.';
comment on column public.pois.review_status is 'Moderation state: approved | pending | rejected. Default approved.';
comment on column public.pois.bike_policy   is 'How this transport/lodging handles bicycles (e.g. folded-only on KTX).';
