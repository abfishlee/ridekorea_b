-- 20260630100000_init_schema.sql
-- RideKorea initial schema: extensions, enums, tables, indexes, RLS, triggers.
-- Authoritative source: vision_doc/5_database_schema_sql.md
-- NOTE: this migration must run BEFORE 20260630120000_rpc_functions.sql.

-- ============================================================
-- 0. Extensions
-- ============================================================
create extension if not exists postgis;
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ============================================================
-- 1. Enums
-- ============================================================
create type route_type       as enum ('OFFICIAL','USER');
create type route_visibility as enum ('PRIVATE','PUBLIC');
create type route_status     as enum ('DRAFT','ACTIVE','FINISHED');
create type spot_type        as enum ('SCENERY','REPAIR','FOOD','LODGING','DANGER','START','FINISH','GENERAL');
create type voucher_status   as enum ('ISSUED','REDEEMED','EXPIRED');
create type poi_type         as enum ('RESTAURANT','CAFE','REPAIR','BICYCLE_SHOP','LODGING','CAMPSITE','CONVENIENCE','REST_AREA','TRANSPORT','CERT_CENTER');
create type report_target    as enum ('ROUTE','SPOT','COMMENT','TIP');

-- ============================================================
-- 2. profiles (extends auth.users)
-- ============================================================
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  nationality       varchar(2),
  display_name      text,
  profile_image_url text,
  total_distance_m  double precision not null default 0,
  created_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, profile_image_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          new.raw_user_meta_data->>'avatar_url');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. routes ("everything is a route")
-- ============================================================
create table public.routes (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references public.profiles(id) on delete cascade,
  source_route_id  uuid references public.routes(id) on delete set null,
  type             route_type       not null default 'USER',
  visibility       route_visibility not null default 'PRIVATE',
  status           route_status     not null default 'DRAFT',
  title            text not null,
  summary          text,
  cover_photo_url  text,
  planned_geom     geometry(LineString, 4326),
  track_geom       geometry(LineString, 4326),
  deviated_geom    geometry(MultiLineString, 4326),
  distance_m       double precision default 0,
  elevation_gain_m double precision default 0,
  est_duration_s   integer,
  started_at       timestamptz,
  ended_at         timestamptz,
  likes_count      integer not null default 0,
  comments_count   integer not null default 0,
  created_at       timestamptz not null default now()
);
create index routes_planned_gix on public.routes using gist (planned_geom);
create index routes_track_gix   on public.routes using gist (track_geom);
create index routes_author_idx  on public.routes (author_id);
create index routes_feed_idx    on public.routes (visibility, created_at desc);

alter table public.routes enable row level security;
create policy "public or own routes are selectable"
  on public.routes for select
  using (visibility = 'PUBLIC' or author_id = auth.uid());
create policy "users insert own routes"
  on public.routes for insert with check (author_id = auth.uid());
create policy "users modify own routes"
  on public.routes for update using (author_id = auth.uid());
create policy "users delete own routes"
  on public.routes for delete using (author_id = auth.uid());

-- ============================================================
-- 4. spots (photo + memo pins)
-- ============================================================
create table public.spots (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid not null references public.routes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  location    geometry(Point, 4326) not null,
  photo_url   text,
  title       text,
  memo        text,
  spot_type   spot_type not null default 'GENERAL',
  visited_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index spots_location_gix on public.spots using gist (location);
create index spots_route_idx     on public.spots (route_id);

alter table public.spots enable row level security;
create policy "spots follow parent route visibility"
  on public.spots for select using (
    exists (select 1 from public.routes r
            where r.id = spots.route_id
              and (r.visibility = 'PUBLIC' or r.author_id = auth.uid())));
create policy "users insert own spots"
  on public.spots for insert with check (user_id = auth.uid());
create policy "users modify own spots"
  on public.spots for update using (user_id = auth.uid());
create policy "users delete own spots"
  on public.spots for delete using (user_id = auth.uid());

-- ============================================================
-- 5. likes / comments (+ count triggers)
-- ============================================================
create table public.likes (
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (route_id, user_id)
);
alter table public.likes enable row level security;
create policy "likes selectable by all"   on public.likes for select using (true);
create policy "users like as themselves"  on public.likes for insert with check (user_id = auth.uid());
create policy "users unlike own"           on public.likes for delete using (user_id = auth.uid());

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_route_idx on public.comments (route_id, created_at);
alter table public.comments enable row level security;
create policy "comments follow route visibility"
  on public.comments for select using (
    exists (select 1 from public.routes r
            where r.id = comments.route_id
              and (r.visibility = 'PUBLIC' or r.author_id = auth.uid())));
create policy "users insert own comments" on public.comments for insert with check (user_id = auth.uid());
create policy "users delete own comments" on public.comments for delete using (user_id = auth.uid());

create function public.bump_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'likes' then
    update public.routes
       set likes_count = likes_count + (case when tg_op = 'INSERT' then 1 else -1 end)
     where id = coalesce(new.route_id, old.route_id);
  elsif tg_table_name = 'comments' then
    update public.routes
       set comments_count = comments_count + (case when tg_op = 'INSERT' then 1 else -1 end)
     where id = coalesce(new.route_id, old.route_id);
  end if;
  return null;
end; $$;
create trigger likes_count_trg    after insert or delete on public.likes    for each row execute function public.bump_counts();
create trigger comments_count_trg after insert or delete on public.comments for each row execute function public.bump_counts();

-- ============================================================
-- 6. logistics_tips
-- ============================================================
create table public.logistics_tips (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.profiles(id) on delete set null,
  category   text,
  title      text not null,
  body       text not null,
  region     text,
  upvotes    integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.logistics_tips enable row level security;
create policy "tips readable by all"   on public.logistics_tips for select using (true);
create policy "users insert own tips"  on public.logistics_tips for insert with check (author_id = auth.uid());
create policy "users modify own tips"  on public.logistics_tips for update using (author_id = auth.uid());

-- ============================================================
-- 7. regions / vouchers / voucher_claims
-- ============================================================
create table public.regions (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  name_en  text,
  boundary geometry(MultiPolygon, 4326) not null
);
create index regions_gix on public.regions using gist (boundary);
alter table public.regions enable row level security;
create policy "regions readable by all" on public.regions for select using (true);

create table public.vouchers (
  id             uuid primary key default gen_random_uuid(),
  region_id      uuid not null references public.regions(id) on delete cascade,
  partner_name   text,
  title          text not null,
  title_en       text,
  discount_type  text not null default 'PERCENT',  -- 'PERCENT' | 'AMOUNT'
  discount_value integer not null,
  total_quantity integer,
  issued_count   integer not null default 0,
  valid_from     timestamptz,
  valid_to       timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index vouchers_region_idx on public.vouchers (region_id, is_active);
alter table public.vouchers enable row level security;
create policy "active vouchers readable by all"
  on public.vouchers for select using (is_active = true);

create table public.voucher_claims (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references public.vouchers(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  code        text not null,
  status      voucher_status not null default 'ISSUED',
  claimed_at  timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (voucher_id, user_id)
);
alter table public.voucher_claims enable row level security;
create policy "users read own claims"
  on public.voucher_claims for select using (user_id = auth.uid());
-- INSERT/UPDATE only via Edge Function RPCs (claim_voucher / redeem_voucher).

-- ============================================================
-- 8. certification_centers / stamps
-- ============================================================
create table public.certification_centers (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  name_en  text,
  corridor text,
  location geometry(Point, 4326) not null
);
create index cert_gix on public.certification_centers using gist (location);
alter table public.certification_centers enable row level security;
create policy "cert centers readable by all" on public.certification_centers for select using (true);

create table public.stamps (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  center_id  uuid not null references public.certification_centers(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  primary key (user_id, center_id)
);
alter table public.stamps enable row level security;
create policy "users read own stamps" on public.stamps for select using (user_id = auth.uid());
-- INSERT only via award_stamp RPC (GPS proximity check).

-- ============================================================
-- 9. pois (FastAPI ETL target)
-- ============================================================
create table public.pois (
  id                uuid primary key default gen_random_uuid(),
  source            text not null,
  source_ref        text,
  poi_type          poi_type not null,
  name              text,
  name_en           text,
  location          geometry(Point, 4326) not null,
  meta              jsonb,
  source_updated_at timestamptz,
  unique (source, source_ref)
);
create index pois_location_gix on public.pois using gist (location);
create index pois_type_idx     on public.pois (poi_type);
alter table public.pois enable row level security;
create policy "pois readable by all" on public.pois for select using (true);
-- Writes performed by FastAPI ETL using the service role.

-- ============================================================
-- 10. reports (moderation)
-- ============================================================
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type report_target not null,
  target_id   uuid not null,
  reason      text,
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "users insert reports" on public.reports for insert with check (reporter_id = auth.uid());
-- SELECT restricted to operators (separate role / dashboard).

-- ============================================================
-- 11. Grants (coarse table privileges; RLS does the row-level filtering)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
