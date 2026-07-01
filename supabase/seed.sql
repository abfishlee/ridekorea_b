-- supabase/seed.sql
-- Pilot/dev seed so the app boots with content (no empty screens).
-- Applied automatically by `supabase db reset` (after migrations) on LOCAL dev.
-- Coordinates are SIMPLIFIED/APPROXIMATE placeholders for development.

-- ============================================================
-- DEMO RIDER (Peter) — LOCAL DEV ONLY
-- Inserting into auth.users directly is a local-seed convenience. The
-- `on_auth_user_created` trigger auto-creates his public.profiles row from
-- raw_user_meta_data, so we only UPDATE the profile afterwards.
--
-- ⚠️ If this block errors on your Supabase version, comment it out and use the
--    "manual demo rider" steps in the chat (sign up in-app, then run a snippet
--    with that account's UUID). The rest of the seed does not depend on auth.
-- ============================================================
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated',
   'peter@demo.ridekorea.app',
   crypt('demo-password-123', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Peter","avatar_url":"https://api.dicebear.com/7.x/bottts/svg?seed=peter"}',
   '', '', '', '')
on conflict (id) do nothing;

update public.profiles
   set nationality = 'GB', display_name = 'Peter'
 where id = '11111111-1111-1111-1111-111111111111';

-- ============================================================
-- OFFICIAL ROUTE — 서울–부산 (4대강), author-less
-- ============================================================
insert into public.routes
  (id, author_id, type, visibility, status, title, summary,
   planned_geom, distance_m, est_duration_s)
values
  ('00000000-0000-0000-0000-0000000000a1', null, 'OFFICIAL', 'PUBLIC', 'FINISHED',
   'Seoul → Busan (Four Rivers)',
   'The classic cross-country route along Korea''s Four Rivers cycle path.',
   ST_GeomFromText('LINESTRING(126.978 37.5665, 127.49 37.49, 127.93 36.99, 128.16 36.41, 128.60 35.87, 128.75 35.49, 129.0756 35.1796)', 4326),
   633000, 5*24*3600)
on conflict (id) do nothing;

-- ============================================================
-- RIDER STORY — Peter's travelogue (USER / PUBLIC) + spots
-- ============================================================
insert into public.routes
  (id, author_id, type, visibility, status, title, summary,
   planned_geom, track_geom, distance_m, est_duration_s,
   likes_count, comments_count)
values
  ('00000000-0000-0000-0000-0000000000b1',
   '11111111-1111-1111-1111-111111111111', 'USER', 'PUBLIC', 'FINISHED',
   '베어링과 함께한 대전 강변 투어',
   'Geum River estuary up to Daejeon — repair shops, food, and the spots to avoid.',
   ST_GeomFromText('LINESTRING(126.7415 36.0007, 126.90 36.10, 127.05 36.20, 127.20 36.30, 127.38 36.35)', 4326),
   ST_GeomFromText('LINESTRING(126.7415 36.0007, 126.90 36.10, 127.05 36.20, 127.20 36.30, 127.38 36.35)', 4326),
   82000, 6*3600, 10, 4)
on conflict (id) do nothing;

insert into public.spots (route_id, user_id, location, photo_url, title, memo, spot_type)
values
  ('00000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111',
   ST_SetSRID(ST_MakePoint(126.7415, 36.0007), 4326), null,
   'Start at Geum River estuary', '드디어 출발, 설레는 마음을 끝까지!', 'START'),
  ('00000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111',
   ST_SetSRID(ST_MakePoint(126.90, 36.10), 4326), null,
   'Flat tire here', '타이어가 터졌는데 1km 전방에 친절한 수리점이 있다.', 'REPAIR'),
  ('00000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111',
   ST_SetSRID(ST_MakePoint(127.20, 36.30), 4326), null,
   'Amazing gukbap', '이 국밥집은 엄청나다!', 'FOOD'),
  ('00000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111',
   ST_SetSRID(ST_MakePoint(127.30, 36.33), 4326), null,
   'Avoid Motel A', '다음 마을의 A 모텔은 자전거 반입을 거부하니 가지 마라.', 'DANGER');

-- ============================================================
-- REGION + VOUCHERS — 부여군 (Buyeo-gun) pilot
-- ============================================================
insert into public.regions (id, name, name_en, boundary)
values
  ('00000000-0000-0000-0000-0000000000c1', '부여군', 'Buyeo-gun',
   ST_GeomFromText('MULTIPOLYGON(((126.85 36.20, 127.00 36.20, 127.00 36.34, 126.85 36.34, 126.85 36.20)))', 4326))
on conflict (id) do nothing;

insert into public.vouchers
  (region_id, partner_name, title, title_en, discount_type, discount_value,
   total_quantity, is_active)
values
  ('00000000-0000-0000-0000-0000000000c1', '부여 한우국밥',
   '한우 국밥 20% 할인', 'Hanwoo Gukbap 20% off', 'PERCENT', 20, 500, true),
  ('00000000-0000-0000-0000-0000000000c1', '백제민박',
   '숙박 1만 원 할인', '₩10,000 off your stay', 'AMOUNT', 10000, 200, true);

-- ============================================================
-- CERTIFICATION CENTERS (national cross-country stamps)
-- ============================================================
insert into public.certification_centers (name, name_en, corridor, location)
values
  ('금강하구둑 인증센터', 'Geumgang Estuary Bank', '금강',
   ST_SetSRID(ST_MakePoint(126.7415, 36.0007), 4326)),
  ('대청댐 인증센터', 'Daecheong Dam', '금강',
   ST_SetSRID(ST_MakePoint(127.4806, 36.4806), 4326)),
  ('낙동강하구둑 인증센터', 'Nakdong Estuary Bank', '낙동강',
   ST_SetSRID(ST_MakePoint(128.9636, 35.1050), 4326));

-- ============================================================
-- POIs (normally populated by FastAPI ETL; a few dev samples here)
-- ============================================================
insert into public.pois (source, source_ref, poi_type, name, name_en, location, meta)
values
  ('SEED', 'repair-1', 'REPAIR', '강변 자전거 수리점', 'Riverside Bike Repair',
   ST_SetSRID(ST_MakePoint(126.90, 36.10), 4326), '{"phone":"041-000-0001"}'),
  ('SEED', 'food-1', 'RESTAURANT', '나루터 국밥', 'Naruteo Gukbap',
   ST_SetSRID(ST_MakePoint(127.20, 36.30), 4326), '{"hours":"08:00-20:00"}'),
  ('SEED', 'lodging-1', 'LODGING', '백마강 게스트하우스', 'Baekmagang Guesthouse',
   ST_SetSRID(ST_MakePoint(126.91, 36.27), 4326), '{"bike_friendly":true}')
on conflict (source, source_ref) do nothing;


-- ============================================================
-- COLD-START SEED ??pioneer travelogues (PUBLIC) so the feed is alive at launch.
-- LOCAL DEV: inserts demo auth.users; the on_auth_user_created trigger creates
-- their profiles, then we UPDATE nationality/display_name. Idempotent.
-- ============================================================
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222',
   'authenticated','authenticated','yuki@demo.ridekorea.app',
   crypt('demo-password-123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Yuki","avatar_url":"https://api.dicebear.com/7.x/bottts/svg?seed=yuki"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333',
   'authenticated','authenticated','lena@demo.ridekorea.app',
   crypt('demo-password-123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Lena","avatar_url":"https://api.dicebear.com/7.x/bottts/svg?seed=lena"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444',
   'authenticated','authenticated','mateo@demo.ridekorea.app',
   crypt('demo-password-123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Mateo","avatar_url":"https://api.dicebear.com/7.x/bottts/svg?seed=mateo"}','','','','')
on conflict (id) do nothing;

update public.profiles set nationality='JP', display_name='Yuki'  where id='22222222-2222-2222-2222-222222222222';
update public.profiles set nationality='DE', display_name='Lena'  where id='33333333-3333-3333-3333-333333333333';
update public.profiles set nationality='ES', display_name='Mateo' where id='44444444-4444-4444-4444-444444444444';

insert into public.routes
  (id, author_id, type, visibility, status, title, summary, cover_photo_url,
   planned_geom, track_geom, distance_m, est_duration_s, elevation_gain_m,
   likes_count, comments_count)
values
  ('00000000-0000-0000-0000-0000000000b2','22222222-2222-2222-2222-222222222222',
   'USER','PUBLIC','FINISHED',
   'Cherry blossoms along the Han',
   'A gentle spring loop from the Ara West Sea lock to Paldang ??cafes, blossoms, and flat riverside paths perfect for day one.',
   'https://picsum.photos/seed/ridekorea-han/800/450',
   ST_GeomFromText('LINESTRING(126.605 37.565, 126.80 37.57, 126.97 37.52, 127.12 37.54, 127.32 37.60)',4326),
   ST_GeomFromText('LINESTRING(126.605 37.565, 126.80 37.57, 126.97 37.52, 127.12 37.54, 127.32 37.60)',4326),
   58000, 4*3600, 120, 23, 5),
  ('00000000-0000-0000-0000-0000000000b3','33333333-3333-3333-3333-333333333333',
   'USER','PUBLIC','FINISHED',
   'Surviving Saejae Pass',
   'The toughest climb on the cross-country route. Pack water, take the tunnel detour in rain, and earn that downhill into Mungyeong.',
   'https://picsum.photos/seed/ridekorea-saejae/800/450',
   ST_GeomFromText('LINESTRING(128.05 36.74, 128.10 36.78, 128.15 36.84, 128.20 36.90)',4326),
   ST_GeomFromText('LINESTRING(128.05 36.74, 128.10 36.78, 128.15 36.84, 128.20 36.90)',4326),
   41000, 5*3600, 760, 31, 8),
  ('00000000-0000-0000-0000-0000000000b4','44444444-4444-4444-4444-444444444444',
   'USER','PUBLIC','FINISHED',
   'Nakdong sunset run to Busan',
   'The final stretch: long flat riverbanks, an afternoon tailwind, and the sea waiting at the end. Finish at the Nakdong estuary.',
   'https://picsum.photos/seed/ridekorea-nakdong/800/450',
   ST_GeomFromText('LINESTRING(128.40 35.85, 128.55 35.65, 128.75 35.45, 128.90 35.25, 129.00 35.10)',4326),
   ST_GeomFromText('LINESTRING(128.40 35.85, 128.55 35.65, 128.75 35.45, 128.90 35.25, 129.00 35.10)',4326),
   96000, 7*3600, 210, 15, 3)
on conflict (id) do nothing;

insert into public.spots (route_id, user_id, location, photo_url, title, memo, spot_type)
select v.route_id, v.user_id, v.location, v.photo_url, v.title, v.memo, v.spot_type::spot_type
from (values
  ('00000000-0000-0000-0000-0000000000b2'::uuid,'22222222-2222-2222-2222-222222222222'::uuid,
   ST_SetSRID(ST_MakePoint(126.605,37.565),4326),'https://picsum.photos/seed/han-start/600/400',
   'Ara West Sea lock','Certification booth here ??stamp your passport before you roll out.','START'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid,'22222222-2222-2222-2222-222222222222'::uuid,
   ST_SetSRID(ST_MakePoint(126.97,37.52),4326),'https://picsum.photos/seed/han-cafe/600/400',
   'Riverside cafe','Best iced coffee with a view of the bridge. Bike racks out front.','FOOD'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid,'22222222-2222-2222-2222-222222222222'::uuid,
   ST_SetSRID(ST_MakePoint(127.32,37.60),4326),'https://picsum.photos/seed/han-paldang/600/400',
   'Paldang reservoir','Turnaround point. The blossoms peak in early April.','SCENERY'),
  ('00000000-0000-0000-0000-0000000000b3'::uuid,'33333333-3333-3333-3333-333333333333'::uuid,
   ST_SetSRID(ST_MakePoint(128.05,36.74),4326),'https://picsum.photos/seed/saejae-foot/600/400',
   'Climb starts','Fill bottles here. Nothing open for the next 15 km uphill.','REPAIR'),
  ('00000000-0000-0000-0000-0000000000b3'::uuid,'33333333-3333-3333-3333-333333333333'::uuid,
   ST_SetSRID(ST_MakePoint(128.15,36.84),4326),'https://picsum.photos/seed/saejae-tunnel/600/400',
   'Rain detour tunnel','In heavy rain take the tunnel ??the gravel switchbacks get dangerous.','DANGER'),
  ('00000000-0000-0000-0000-0000000000b3'::uuid,'33333333-3333-3333-3333-333333333333'::uuid,
   ST_SetSRID(ST_MakePoint(128.20,36.90),4326),'https://picsum.photos/seed/saejae-top/600/400',
   'Pass summit','You made it. Brake check before the long descent into Mungyeong.','SCENERY'),
  ('00000000-0000-0000-0000-0000000000b4'::uuid,'44444444-4444-4444-4444-444444444444'::uuid,
   ST_SetSRID(ST_MakePoint(128.55,35.65),4326),'https://picsum.photos/seed/nak-lunch/600/400',
   'Riverside lunch','Family-run place, huge portions, very bike-friendly owner.','FOOD'),
  ('00000000-0000-0000-0000-0000000000b4'::uuid,'44444444-4444-4444-4444-444444444444'::uuid,
   ST_SetSRID(ST_MakePoint(128.90,35.25),4326),'https://picsum.photos/seed/nak-camp/600/400',
   'Free campsite','Flat grass under a bridge, safe and quiet. Water tap nearby.','LODGING'),
  ('00000000-0000-0000-0000-0000000000b4'::uuid,'44444444-4444-4444-4444-444444444444'::uuid,
   ST_SetSRID(ST_MakePoint(129.00,35.10),4326),'https://picsum.photos/seed/nak-finish/600/400',
   'Nakdong estuary finish','The end of the line. Dip your wheel in the sea.','FINISH')
) as v(route_id, user_id, location, photo_url, title, memo, spot_type)
where not exists (
  select 1 from public.spots s
  where s.route_id = v.route_id and s.title = v.title
);

-- ============================================================
-- Logistics guide board (Phase 7.2) — curated tips (author_id null).
-- Idempotent: guarded by title match.
-- Categories: AIRPORT | TRAIN | SUBWAY | RENTAL | GENERAL
-- ============================================================
insert into public.logistics_tips (author_id, category, title, body, region)
select null, v.category, v.title, v.body, v.region
from (values
  ('AIRPORT', 'Bikes at Incheon Airport (ICN)',
   'You can roll a boxed or bagged bike through departures. Airport limousine buses carry bagged bikes in the luggage hold; the AREX airport train allows folded or bagged bikes during off-peak hours. Reassemble at the arrivals plaza before heading to the Ara Canal path.',
   'Incheon'),
  ('TRAIN', 'Taking your bike on the KTX',
   'KTX high-speed trains have no dedicated bike racks, so bring a bike bag (rinko-style) and fully cover the bike, then stow it in the luggage area at the ends of the car. ITX-Cheongchun and some Mugunghwa trains have proper bike spaces you can reserve.',
   'Nationwide'),
  ('SUBWAY', 'Bikes on the Seoul subway',
   'Full-size bikes are allowed only on weekends and public holidays, normally in the first or last car. Folding bikes are welcome any day if folded and bagged. Use elevators, and avoid rush hour even on allowed days.',
   'Seoul'),
  ('RENTAL', 'Renting a touring bike',
   'Shops near the Four Rivers path (Seoul, Yangpyeong, Busan and more) rent hybrids and touring bikes by the day. Book ahead in spring and autumn peak season, and bring your passport for the deposit.',
   'Nationwide'),
  ('GENERAL', 'Certification passport and red booths',
   'Buy the Four Rivers passport at any certification center or online, then self-stamp at the red phone-booth kiosks spaced along the path. Collect every stamp to earn the grand-slam medal at the end.',
   'Nationwide'),
  ('GENERAL', 'Where to sleep along the path',
   'Look for motels in towns for cheap, clean, private rooms, and free riverside campsites near certification centers. Convenience stores are everywhere for water, snacks and quick hot meals.',
   'Nationwide')
) as v(category, title, body, region)
where not exists (
  select 1 from public.logistics_tips t where t.title = v.title
);
