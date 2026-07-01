# 6. 핵심 흐름 및 알고리즘 (Core Flows & Algorithms)

> 구현 난도가 높은 부분만 정밀 명세한다. 의사코드는 의도 전달용이며 실제 타입은 `5_database_schema_sql.md` + 생성된 DB 타입을 따른다.

## 1. GPS 추적 + 오프라인 아웃박스 동기화

**전제(개발 환경)**: `expo-location` 백그라운드 위치는 **Expo Go 불가**. Dev Client/EAS Build 필요. iOS `UIBackgroundModes: location`, Android `ACCESS_BACKGROUND_LOCATION` 권한·고지 필요(스토어 심사 대비 목적 문구 작성).

**아웃박스 테이블(SQLite, 로컬)**
```text
outbox_track_points(id uuid PK, route_id, lat, lng, elevation, captured_at, synced int default 0)
outbox_spots(id uuid PK, route_id, lat, lng, photo_local_path, photo_url, title, memo, spot_type, captured_at, synced int)
```

**수집 루프(클라이언트)**
```pseudo
on Start(route_id):
  define background task TRACK:
    on location update (throttle ~ every N sec or M meters):
      insert outbox_track_points(uuid(), route_id, lat, lng, elev, now(), synced=0)
      updateLiveTrackOnMap(point)          # 즉시 렌더(낙관적)
      classifyDeviation(point)             # §2

flush loop (every ~30s AND on connectivity-regained):
  if online:
    batch = select * from outbox_* where synced=0 limit 200
    upsert batch -> Supabase (PK=client uuid => 멱등)
    mark synced=1 on success
```
핵심 규칙: **PK는 클라이언트 생성 UUID** → 재전송해도 중복 insert가 안 됨(멱등). 서버 시간을 신뢰하지 말고 `captured_at`은 단말 시각으로 저장.

## 2. 경로 이탈 감지 (Blue / Pink)

목표: 현재 위치가 `planned_geom`에서 멀어지면 "이탈"로 보고 분홍 구간을 누적.

```pseudo
THRESH_ENTER = 40   # m, 이탈 진입
THRESH_EXIT  = 25   # m, 복귀(히스테리시스로 깜빡임 방지)
state = ON_ROUTE
buffer = []         # 현재 이탈 구간 좌표

classifyDeviation(point):
  d = distancePointToLine(point, planned_geom)   # client: turf.pointToLineDistance
  if state == ON_ROUTE and d > THRESH_ENTER:
     state = DEVIATED; buffer = [lastOnRoutePoint, point]
  elif state == DEVIATED:
     buffer.push(point)
     if d < THRESH_EXIT:
        state = ON_ROUTE
        appendSegmentToDeviated(buffer)   # buffer -> deviated_geom 후보
        buffer = []
  render: ON_ROUTE 구간=Aero Blue, DEVIATED 구간=Adventure Pink
```
- 클라이언트는 표시만; 최종 `deviated_geom`(MultiLineString) 확정은 종료 시 서버에서(§6) 재조립.
- GPS 노이즈 대비: 정확도 낮은 포인트(`accuracy > 30m`)는 버리거나 가중. 짧은(예: <50m) 이탈 구간은 노이즈로 무시.

## 3. 바우처 지오펜싱 + 발급 + 부정사용 방지

**클라이언트(진입 감지)**
```pseudo
on enterRideOrRegionChange:
  regions = GET active voucher regions near(currentLatLng, radius=30km)   # 캐시
  startGeofencing(regions[0..19])   # iOS 최대 20개 → 가까운 것만
on geofence ENTER(region_id):
  call EdgeFn claim_voucher({ region_id, location: currentLatLng })
  if ok: show VoucherCard; refresh Wallet
```

**Edge Function `claim_voucher` (서버 — service role)**
```pseudo
input: { region_id, location }   # auth: 사용자 JWT
1. region = select boundary from regions where id=region_id
2. assert ST_Contains(region.boundary, location)        # 실제 위치 재검증(스푸핑 방지)
3. (선택) assert 최근 track_geom이 region을 통과했는지        # 미방문 farming 방지
4. voucher = pick active voucher in region (수량 남은 것)
   assert voucher.total_quantity is null OR issued_count < total_quantity
5. insert voucher_claims(voucher_id, user_id=auth.uid(), code=gen())   # unique(voucher_id,user_id) → 중복 차단
   on conflict: return ALREADY_CLAIMED
6. update vouchers set issued_count = issued_count + 1
7. return claim
```
부정사용 방지 요점: ① 서버가 위치 재검증, ② 유저당 1회(unique), ③ 수량 한도, ④ 레이트리밋(IP/디바이스), ⑤ (강화) 최근 트랙 통과 검증.
> ⚠️ 금전성 바우처는 법적/정산 이슈가 있으니 MVP는 "제휴 매장에서 보여주는 할인쿠폰(코드/QR)"로 시작하고, 실매장 정산·전자금융 이슈는 `7` 리스크 참조.

## 4. 루트 가져오기 (Import)

**Edge Function `import_route`**
```pseudo
input: { source_route_id }   # auth: 사용자
1. src = select * from routes where id=source_route_id and visibility='PUBLIC'
2. insert routes(author_id=auth.uid(), source_route_id=src.id,
                 type='USER', visibility='PRIVATE', status='DRAFT',
                 title=src.title, planned_geom=src.planned_geom,
                 distance_m=src.distance_m, est_duration_s=src.est_duration_s)
3. return new route id   # 이걸 들고 Ride 화면 진입
```
(RLS만으로도 클라이언트 insert 가능하지만, 계보·검증을 한곳에 모으기 위해 Edge Function 권장.)

## 5. 사진핀 파이프라인

```pseudo
onPhotoCaptured(photo, gps, ts):
  localPath = save(photo)
  insert outbox_spots(uuid(), route_id, gps.lat, gps.lng, localPath, null, '', '', 'GENERAL', ts, synced=0)
  showPinOnMap(gps)             # 낙관적
flush:
  if online and outbox_spots.photo_url is null:
     url = upload(localPath -> storage: {user}/{route}/{uuid}.jpg)
     update outbox row set photo_url=url
     upsert spots(id, route_id, user_id, location=Point(lng,lat), photo_url, title, memo, spot_type, visited_at)
     mark synced=1
```

## 6. 라이딩 종료 (Finalize)

**Edge Function `finalize_ride`**
```pseudo
input: { route_id }
1. pts = select lat,lng,elevation from track points where route_id order by captured_at
2. track = ST_MakeLine(points)                          # LineString
3. deviated = assemble from deviation segments          # MultiLineString
4. dist = ST_Length(track::geography)                   # meters
5. elev_gain = sum(positive elevation deltas)
6. update routes set track_geom=track, deviated_geom=deviated,
          distance_m=dist, elevation_gain_m=elev_gain,
          status='FINISHED', ended_at=now()
7. update profiles set total_distance_m = total_distance_m + dist where id=auth.uid()
8. return summary
```

## Edge Function 목록(요약)
| 함수 | 입력 | 책임 |
|---|---|---|
| `import_route` | source_route_id | 공개 루트 복제(계보 기록) |
| `claim_voucher` | region_id, location | 위치 재검증·수량·중복 확인 후 발급 |
| `redeem_voucher` | claim_id | (매장) 사용 처리 → status=REDEEMED |
| `toggle_like` | route_id | 좋아요 토글(카운트는 트리거가 처리) |
| `award_stamp` | center_id, location | GPS 근접 검증 후 stamp 발급 |
| `finalize_ride` | route_id | 트랙/이탈 조립·거리 집계·프로필 갱신 |
