# 5. 데이터베이스 스키마 (Supabase SQL — Authoritative)

> 이 문서가 스키마의 단일 진실 공급원(SSOT)이다. 아래 SQL을 `supabase/migrations/`에 순서대로 넣어 적용한다.
> 규칙: **모든 public 테이블은 RLS를 켠다.** 좌표는 SRID 4326. 거리/길이 계산은 `geography` 캐스트로 미터 단위.

```sql
-- 0. 확장
create extension if not exists postgis;

-- 1. ENUMs
create type route_type       as enum ('OFFICIAL','USER');
create type route_visibility as enum ('PRIVATE','PUBLIC');
create type route_status     as enum ('DRAFT','ACTIVE','FINISHED');
create type spot_type        as enum ('SCENERY','REPAIR','FOOD','LODGING','DANGER','START','FINISH','GENERAL');
create type voucher_status   as enum ('ISSUED','REDEEMED','EXPIRED');
create type poi_type         as enum ('RESTAURANT','CAFE','REPAIR','BICYCLE_SHOP','LODGING','CAMPSITE','CONVENIENCE','REST_AREA','TRANSPORT','CERT_CENTER');
create type report_target    as enum ('ROUTE','SPOT','COMMENT','TIP');
```

## profiles (auth.users 확장 — `users` 테이블 직접 생성 금지)

```sql
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  nationality      varchar(2),                 -- ISO 3166-1 alpha-2 (JP, US...)
  display_name     text,
  profile_image_url text,
  total_distance_m double precision not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- auth.users 생성 시 profile 자동 생성
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
```

## routes ("모든 것은 route다" 통합 테이블)

```sql
create table public.routes (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.profiles(id) on delete cascade,  -- OFFICIAL은 null
  source_route_id uuid references public.routes(id) on delete set null,   -- import 계보
  type            route_type       not null default 'USER',
  visibility      route_visibility not null default 'PRIVATE',
  status          route_status     not null default 'DRAFT',
  title           text not null,
  summary         text,
  cover_photo_url text,
  planned_geom    geometry(LineString, 4326),       -- 따라갈 계획 경로
  track_geom      geometry(LineString, 4326),       -- 실제 주행 궤적
  deviated_geom   geometry(MultiLineString, 4326),  -- 분홍 개척로
  distance_m      double precision default 0,
  elevation_gain_m double precision default 0,
  est_duration_s  integer,
  started_at      timestamptz,
  ended_at        timestamptz,
  likes_count     integer not null default 0,
  comments_count  integer not null default 0,
  created_at      timestamptz not null default now()
);
create index routes_planned_gix  on public.routes using gist (planned_geom);
create index routes_track_gix    on public.routes using gist (track_geom);
create index routes_author_idx   on public.routes (author_id);
create index routes_feed_idx     on public.routes (visibility, created_at desc);

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
```

## spots (사진 + 메모 핀)

```sql
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
```

## likes / comments (+ 카운트 트리거)

```sql
create table public.likes (
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (route_id, user_id)
);
alter table public.likes enable row level security;
create policy "likes selectable by all" on public.likes for select using (true);
create policy "users like as themselves" on public.likes for insert with check (user_id = auth.uid());
create policy "users unlike own" on public.likes for delete using (user_id = auth.uid());

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_route_idx on public.comments (route_id, created_at);
alter table public.comments enable row level security;
create policy "comments follow route visibility"
  on public.comments for select using (
    exists (select 1 from public.routes r
            where r.id = comments.route_id
              and (r.visibility='PUBLIC' or r.author_id = auth.uid())));
create policy "users insert own comments" on public.comments for insert with check (user_id = auth.uid());
create policy "users delete own comments" on public.comments for delete using (user_id = auth.uid());

-- 카운트 동기화 트리거
create function public.bump_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'likes' then
    update public.routes set likes_count = likes_count + (case when tg_op='INSERT' then 1 else -1 end)
      where id = coalesce(new.route_id, old.route_id);
  elsif tg_table_name = 'comments' then
    update public.routes set comments_count = comments_count + (case when tg_op='INSERT' then 1 else -1 end)
      where id = coalesce(new.route_id, old.route_id);
  end if;
  return null;
end; $$;
create trigger likes_count_trg    after insert or delete on public.likes    for each row execute function public.bump_counts();
create trigger comments_count_trg after insert or delete on public.comments for each row execute function public.bump_counts();
```

## logistics_tips (커뮤니티 게시판)

```sql
create table public.logistics_tips (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  category text,                        -- 'AIRPORT_JUMP','PACKING','TRANSIT'...
  title text not null,
  body  text not null,
  region text,
  upvotes integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.logistics_tips enable row level security;
create policy "tips readable by all" on public.logistics_tips for select using (true);
create policy "users insert own tips" on public.logistics_tips for insert with check (author_id = auth.uid());
create policy "users modify own tips" on public.logistics_tips for update using (author_id = auth.uid());
```

## regions / vouchers / voucher_claims (지역 상생 바우처)

```sql
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null, name_en text,
  boundary geometry(MultiPolygon, 4326) not null
);
create index regions_gix on public.regions using gist (boundary);
alter table public.regions enable row level security;
create policy "regions readable by all" on public.regions for select using (true);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete cascade,
  partner_name text,
  title text not null, title_en text,
  discount_type text not null default 'PERCENT',  -- 'PERCENT' | 'AMOUNT'
  discount_value integer not null,
  total_quantity integer,            -- null = 무제한
  issued_count integer not null default 0,
  valid_from timestamptz, valid_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index vouchers_region_idx on public.vouchers (region_id, is_active);
alter table public.vouchers enable row level security;
create policy "active vouchers readable by all"
  on public.vouchers for select using (is_active = true);

create table public.voucher_claims (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  status voucher_status not null default 'ISSUED',
  claimed_at  timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (voucher_id, user_id)        -- 유저당 1회 발급(부정사용 방지)
);
alter table public.voucher_claims enable row level security;
create policy "users read own claims"
  on public.voucher_claims for select using (user_id = auth.uid());
-- INSERT/UPDATE는 Edge Function(service role)에서만. anon/authenticated 직접 insert 정책을 만들지 않는다.
```

## certification_centers / stamps (종주 스탬프)

```sql
create table public.certification_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null, name_en text,
  corridor text,                          -- '한강','낙동강'...
  location geometry(Point, 4326) not null
);
create index cert_gix on public.certification_centers using gist (location);
alter table public.certification_centers enable row level security;
create policy "cert centers readable by all" on public.certification_centers for select using (true);

create table public.stamps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  center_id uuid not null references public.certification_centers(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  primary key (user_id, center_id)
);
alter table public.stamps enable row level security;
create policy "users read own stamps" on public.stamps for select using (user_id = auth.uid());
-- INSERT는 Edge Function(service role)에서 GPS 근접 검증 후.
```

## pois (FastAPI ETL이 월 1회 upsert)

```sql
create table public.pois (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'TOURAPI','GOCAMPING','BIKE_DB'...
  source_ref text,                       -- 원본 식별자
  poi_type poi_type not null,
  name text, name_en text,
  location geometry(Point, 4326) not null,
  meta jsonb,
  source_updated_at timestamptz,
  unique (source, source_ref)
);
create index pois_location_gix on public.pois using gist (location);
create index pois_type_idx     on public.pois (poi_type);
alter table public.pois enable row level security;
create policy "pois readable by all" on public.pois for select using (true);
-- 쓰기는 FastAPI가 service role로 수행.
```

## reports (모더레이션)

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type report_target not null,
  target_id   uuid not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "users insert reports" on public.reports for insert with check (reporter_id = auth.uid());
-- SELECT은 운영자(별도 role/대시보드)만.
```

## Storage 버킷 정책 (사진)
```text
버킷: route-photos (public read, authenticated write)
- 경로 규칙: {user_id}/{route_id}/{uuid}.jpg
- Storage RLS: insert/update/delete는 경로 첫 세그먼트(user_id)가 auth.uid()와 일치할 때만 허용.
- 원본은 비공개로 두고 변환/리사이즈 URL을 표시용으로 쓰는 것을 권장.
```

> 타입 생성: 스키마 적용 후 `supabase gen types typescript --linked > src/types/database.ts` 로 프론트 타입을 자동 생성해 사용한다.
