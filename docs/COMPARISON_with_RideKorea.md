# 🔬 RideKorea vs RideKorea_b — 소스 레벨 비교 분석

> 동일 시나리오를 두 AI(Claude/GPT)에게 주고 각각 개발한 두 코드베이스를 소스 기준으로 비교한다.
> 대상: `E:\dev\RideKorea`(이하 **A안**, FastAPI+PostGIS+자체 라우팅) vs `E:\dev\RideKorea_b`(**우리**, Supabase RPC+RLS).
> 최종 업데이트: 2026-07-01 · 반영 계획 → `docs/UPGRADE_PLAN_from_comparison.md`

## 0. 한 줄 요약
완전히 다른 베팅. A안은 라우팅·어드민·모더레이션·POI ETL까지 갖춘 **정통 3-tier 서버**(운영 부담↑, 일부 지표는 클라 신뢰). 우리는 **Supabase 중심의 얇고 안전한 스택**(보안·서버권위 지표·오프라인·저비용지도 우위, 라우팅/어드민 미구현).

## 1. 아키텍처 대비

| 항목 | A안 (RideKorea) | 우리 (RideKorea_b) |
|---|---|---|
| 백엔드 | FastAPI (routers→services→models) + PostGIS + Alembic | Supabase: Postgres + RPC(SECURITY DEFINER) + RLS |
| 클라 통신 | REST + Bearer 토큰 (`services/api.ts`) | supabase-js 직결 |
| 지도 | 프로바이더 추상화(Naver/Mapbox/Google) | Naver WebView 단일 (`buildRideMapHtml`) |
| 라우팅(A→B) | 3-tier 엔진(공식코스→OSM자전거→도보) | 없음 (import만) |
| 오프라인 | 트랙 큐 코어 존재, 시작은 온라인 결합 | expo-sqlite outbox, 오프라인 퍼스트 + 복구 |
| 지표 | 클라 하버사인(`summarizeRideTrack`) | 서버 PostGIS `ST_Length`(finalize_ride) |
| 접근제어 | 앱 레벨(`.where(user_id==user.id)` 반복) | RLS(deny-by-default) |
| 어드민/모더 | 있음 | 없음 |
| 타입 | 수기 `types/ridekorea.ts` | DB 생성 `gen:types` |
| 운영 | FastAPI+PostGIS+GraphHopper+Nginx+SSL+홈서버 | Supabase(서버 운영 0) |

## 2. 🎓 우리가 배울 점 (A안이 잘한 것)

### 2.1 자전거 라우팅 엔진 — 우리에게 없는 제품 기능
- 파일: `backend/app/services/routing/{base,orchestrator,osm_bike}.py`
- `RoutingOrchestrator.route()` 3-tier: ① 저장 공식코스 GeoJSON → ② OSM 자전거(GraphHopper) → ③ 도보.
- 엔진이 서비스 불가 시 `None` 반환 → 다음 tier로 흘림. `httpx` 지연 import로 의존성 없어도 부팅. "한국은 자전거 라우팅 벤더 API 없음 → 차량 API 대체 안 함" 통찰 명시.
- 우리 gap: A→B 경로 계산 0. 최소 `RouteRequest/RouteResult/RouteSource` 계약 도입 가치.

### 2.2 지도 프로바이더 추상화 — 지금 반영 권장
- 파일: `frontend/src/map/{MapProvider,types,index}.ts`, `providers/NaverMapProvider.tsx`
- 화면·훅은 인터페이스(`setRoutes/setMarkers/moveCamera/fitBounds/on`)만 의존. `createMapProvider()` + `MAP_CONFIG.primary`로 렌더러 교체 한 줄. 능력 플래그 `supportsOffline/hasKoreanRoadDetail`. 좌표순서(`{lat,lng}` vs `[lng,lat]`)를 `types.ts` 한 곳에서 관리.
- 우리 gap: `src/lib/naverMap.ts`가 Naver 하드코딩 → 벤더/과금 리스크가 화면에 샘.

### 2.3 순수 함수 + 단위 테스트 코어
- 파일: `frontend/src/utils/{ride-metrics.ts + .test.ts, offline-track-queue-core.ts}`
- GPS 점프 제거: `summarizeRideTrack`이 1km 이상 세그먼트(`GPS_JUMP_THRESHOLD_KM`)를 거리에서 제외.
- 오프라인 큐 = 순수 배열 reducer(enqueue/cap/markAttempt/removeCount/normalize). `normalizeOfflineTrackQueue`가 저장 JSON을 `isValidTrackPoint`로 방어검증. 실제 테스트 존재(우리는 0).

### 2.4 계층형 백엔드 + 데이터 모델
- `TravelPoi` 출처/라이선스: `source, source_url, source_name, license_type, attribution, retrieved_at, external_id, review_status`.
- 물류를 POI에 내장: `transport_mode, bike_policy(_en), packing_required, packing_notes, booking_url`.
- 크라우드/모더: `TravelPoiFeedback`(recommend/caution, user+poi unique) + `TravelPoiReport`(closed/wrong_location/danger, open/resolved/dismissed).
- 정책 vs 인스턴스 분리: `VoucherConfig` ↔ 발급 `Voucher`.
- 발행본=여정 스냅샷 분리: `publish_from_journey`가 다이어리 정렬해 `SharedRouteStop` 스냅샷 생성.
- `core/geo.py`가 PostGIS↔latlng 변환을 한 곳에 모음. 어드민 surface 존재.

## 3. ✅ 우리가 더 나은 점
1. **보안(RLS)** — DB deny-by-default. A안은 앱레벨 `.where(user_id==user.id)` 반복(한 곳 누락=유출).
2. **서버 권위 지표** — `finalize_ride`가 `ST_Length(geography)` 서버 계산. A안 거리는 클라 JS 하버사인, 코스 duration은 15km/h 하드코딩(`_CYCLING_SPEED_MPS`).
3. **오프라인 퍼스트** — outbox 영속 + `recover()`. A안 `use-journey-ride`는 시작이 await 네트워크(들머리 오프라인이면 시작 불가).
4. **실시간 이탈 히스테리시스** — `deviation.ts` 40m/25m 라이브 파랑→분홍. A안은 `is_off_route` 사후 카운트만.
5. **운영·생성 타입** — 서버 운영 0 + `gen:types` 드리프트 방지. A안은 홈서버 운영 + 수기 타입 이중진실.

> ⚖️ 공정: A안의 자체 호스팅은 SaaS 종속 0이라는 진짜 장점(Supabase 요금/한도 문제 시 유리).

## 4. 판정 & 우선순위
- 지금 반영(Tier A/B): 지도 프로바이더 인터페이스 · 순수/테스트 코어+GPS점프+outbox검증 · POI 출처/라이선스/물류 컬럼 · feedback/report 테이블.
- 나중(Tier C): 라우팅 엔진 어댑터 · 발행본 스냅샷 분리 · 어드민 surface.
- 지킬 엣지: RLS, PostGIS 서버지표, 오프라인 퍼스트, 저비용 지도, 생성 타입, 라이브 이탈.
