# 🚀 반영 고도화 플랜 (비교 분석 기반)

> 근거: `docs/COMPARISON_with_RideKorea.md` · 목표: Tier A 완주 + Tier B 스캐폴딩.
> 규칙: 한 번에 하나씩 → `npm run typecheck`(exit 0) → 가능하면 로컬 Supabase 검증 → **커밋·push + 이 MD에 완료 표기**.

## 📌 진행 로그
- ✅ **A1 완료** (2026-07-01, commit `83481a7`) — `track.ts` GPS 점프 가드(`maxJumpM`/`maxJumpGapS`) + 순수 `ride-metrics.ts`(`summarizeTrack`) + `ride-metrics.test.ts` 17 assertion 통과 + 스토어 `start/recover`에 `maxJumpM=500` 배선 + `npm run test:cores` 스크립트. typecheck exit 0. (문서 커밋 `2489987`… 실제 A1 코드 `83481a7`)
- ✅ **A2 완료** (2026-07-01, commit `b6de17d`) — `outbox-validate.ts`(순수 `isValidLngLat`/`sanitizePlannedLine`/`sanitizeTrackPoints`, throw 없음) + `recover()`가 `plannedGeoJSON`·트랙포인트를 hydrate 전 sanitize → 손상 데이터로 크래시/NaN 방지. `outbox-validate.test.ts` 25 assertion. `test:cores` 두 스위트(총 42) 실행. typecheck exit 0.
- ✅ **A3 완료** (2026-07-01, commit `b748e68`) — `src/map/` 신설: `MapProvider` 인터페이스 + provider-neutral 타입 + `NaverWebViewProvider`(기존 `lib/naverMap`에 위임, 단일 지도로드 과금모델 유지) + Mapbox/Google stub + `createMapProvider`팩토리/`MAP_CONFIG`. **네이티브** `RideMap`/`RouteMap`가 Naver 직접 import → `mapProvider` 의존으로 이관(동작 불변). typecheck exit 0.
  - ⚠️ 후속: 웹 변형(`RideMap.web.tsx`/`RouteMap.web.tsx`)은 아직 Naver 웹 SDK 직접 사용(인라인 DOM 지도). 이는 별도 refactor로 이관 예정.
- ✅ **B1 완료** (2026-07-01, commit `7500919`) — `pois`에 출처/라이선스(`source_url`·`source_name`·`license_type`·`attribution`·`review_status` default 'approved'+check+idx) + 물류(`transport_mode`·`bike_policy(_en)`·`packing_required`·`packing_notes(_en)`·`booking_url`) 컴럼 추가. **기존 스키마 존중**: 기존 `source`/`source_ref`(unique)/`source_updated_at`/`meta` 그대로 → `external_id`/`retrieved_at` 중복 안 만듦. 로컬 적용+`schema_migrations` 기록, 시드 3행 approved, check 제약 동작, `gen:types` 재생성. typecheck exit 0.
- ✅ **B2 완료** (2026-07-01, commit `3756320`) — `poi_feedback`(recommend/caution, poi+user unique, RLS 본인만 쓰기) + `pois.recommend_count`/`caution_count`를 SECURITY DEFINER 트리거로 동기화(insert/전환/delete). 기존 `reports` 확장: +`POI` enum 값, +`status`(open/resolved/dismissed)+`resolved_at`. RPC `set_poi_feedback`(upsert/clear, 최신 카운트 반환)·`create_report`(reason 필수). pois read를 `review_status='approved'`로 제한(B1 이월). Peter JWT+ROLLBACK로 해피패스/전환/멱등/4가지 가드 검증. gen:types + typecheck exit 0.

🎉 **Tier A(A1·A2·A3) + Tier B(B1·B2) 전부 완료.** 다음은 Tier C(별도 스프린트) 또는 UI 연결(feedback 버튼·신고 메뉴·물류 표시)—선택 대기.

## 🔌 UI 연결 (B1/B2 백엔드 → 화면)
- ✅ **POI 상세 화면** (2026-07-01, commit `828920f`) — `src/features/poi/api.ts`(`usePoi`·`useMyPoiFeedback`·`useSetPoiFeedback`·`useCreateReport`) + `app/poi/[id].tsx`: 타입 배지, recommend/caution 버튼(실시간 카운트+활성상태, 탭으로 set/switch/clear), 물류 카드(transport_mode/bike_policy/packing/booking_url), 인라인 신고 컴포저(create_report POI), 출처/라이선스 푸터. expo-router 자동 라우팅(`/poi/[id]`). typecheck exit 0.
  - ☐ 잔여: 진입점(POI 목록 화면 또는 지도 마커 탭→네비게이션). 현재는 딥링크(`/poi/<id>`)로 접근. 시드 POI id: `e0a7e754-597e-492b-adb4-535ed1e849bf`.

## 🌙 실행 순서
1. **환경**: Docker Desktop을 **시작 메뉴에서 직접 실행**(에이전트로 켜면 OOM) → `npx supabase start` → `.env`에 anon key.
2. Tier A(코드만, Docker 불필요) 먼저 → 각 항목 typecheck 그린 → 커밋.
3. Tier B(마이그레이션) → `supabase migration up` → `npm run gen:types` → 로컬 검증 → 커밋.

---

## 🟢 Tier A — 코드만(타입체크로 검증)

### A1. 순수 라이드 지표 모듈 + GPS 점프 상한 + 테스트 ✅ (commit `83481a7`)
- **완료**: `ride-metrics.ts`(`summarizeTrack`: 정렬·점프세그먼트 제외 거리·durationS·avgSpeedKmh·**deviatedCount**·hasEnoughTrack), `track.ts`(`maxJumpM`+`maxJumpGapS`로 짧은 간격 점프 스파이크 거부, 긴 gap은 재기준), `ride-metrics.test.ts`(17 assertion), 스토어 배선(`maxJumpM=500`), `npm run test:cores`.
- **검증됨**: `npm run test:cores` all pass + `npm run typecheck` exit 0. `_t/`는 .gitignore.
- 실행 커맨드: `npm run test:cores`

### A2. 복구 outbox 방어검증 ✅ (commit `b6de17d`)
- **완료**: `outbox-validate.ts`(순수 `isValidLngLat`·`sanitizePlannedLine`·`sanitizeTrackPoints`, 절대 throw 안 함), `ride.ts` `recover()`가 `plannedGeoJSON` 파싱과 저장 포인트 hydrate 전에 sanitize 적용(손상 좌표/범위밖/비배열 → 필터 또는 빈배열).
- **검증됨**: `outbox-validate.test.ts` 25 assertion + `npm run typecheck` exit 0. 깨진 데이터 주입에도 복구 무사고.
- 실행 커맨드: `npm run test:cores`

### A3. 지도 프로바이더 인터페이스 (Naver 구현) ✅ (commit `b748e68`)
- **완료**: `src/map/types.ts`(provider-neutral: `LngLat`·`SpotMarker`·`StaticRouteOptions`·`RideUpdate`·`MapProviderId`·`MapLanguage`), `src/map/MapProvider.ts`(`buildStaticRouteHtml`·`buildLiveRideHtml`·`liveRideUpdateScript` + 능력플래그 `supportsOffline`·`hasKoreanRoadDetail`·`isConfigured`), `providers/NaverWebViewProvider.ts`(기존 `lib/naverMap` 위임), `providers/stubs.ts`(Mapbox/Google), `index.ts`(`createMapProvider`·`MAP_CONFIG`·`mapProvider` 싱글톤).
- **이관**: 네이티브 `RideMap.tsx`/`RouteMap.tsx`가 `mapProvider`만 의존(Naver 직접 import 제거). 단일 지도로드 증분갱신(과금 안전) 그대로 유지.
- **검증됨**: `npm run typecheck` exit 0, `test:cores` 42 pass, 기존 화면 동작 불변.
- **잔여**: 웹 변형(`*.web.tsx`)은 Naver 웹 SDK 직접 사용 → 벤더 완전 격리는 별도 후속.

---

## 🟡 Tier B — 스캐폴딩(Docker/Supabase 필요)

### B1. POI 출처·라이선스·물류 마이그레이션 ✅ (commit `7500919`)
- **실제 적용**: `supabase/migrations/20260701100000_poi_provenance_logistics.sql`. 기존 `pois`가 이미 `source`(not null)·`source_ref`(unique with source)·`source_updated_at`·`meta`(jsonb) 보유 → 계획의 `external_id`/`retrieved_at`는 중복이라 **생략**, 부족한 것만 추가.
- **추가 컴럼**: `source_url`, `source_name`, `license_type`, `attribution`, `review_status`(default 'approved', check approved/pending/rejected, `pois_review_status_idx`), `transport_mode`, `bike_policy`, `bike_policy_en`, `packing_required`, `packing_notes`, `packing_notes_en`, `booking_url`.
- **검증됨**: 12컬럼 생성, `schema_migrations` 기록, 시드 3행 approved, check 제약이 잘못된 값 거부, `gen:types` 재생성 + typecheck exit 0.
- **주의**: read 정책(`USING (review_status='approved')`)은 B2로 이월(지금은 `USING (true)` 유지).

<details><summary>당초 계획(참고)</summary>

### B1(원계획). POI 출처·라이선스·물류 마이그레이션
- **선행**: `\d pois`로 기존 컬럼 확인(중복 회피).
- **대상(신규)**: `supabase/migrations/<ts>_poi_provenance_logistics.sql`
  `ALTER TABLE pois ADD COLUMN IF NOT EXISTS` — `source text, source_url text, source_name text,
  license_type text, attribution text, retrieved_at timestamptz, external_id text, review_status text default 'approved',
  transport_mode text, bike_policy text, bike_policy_en text, packing_required boolean, packing_notes text, packing_notes_en text, booking_url text`.
  + `external_id` unique 인덱스(재동기화 upsert 키).
- **검증**: `supabase migration up` → `npm run gen:types` → 조회 RPC/뷰에 필드 노출 확인.
- **AC**: 마이그레이션 성공 + 타입 재생성 반영.

</details>

### B2. feedback/report 테이블 + RPC (8.2 모더레이션 시작) ✅ (commit `3756320`)
- **실제 적용**: `supabase/migrations/20260701110000_moderation.sql`. 기존 `reports` 테이블이 이미 있어(reporter_id·target_type·target_id·reason) **재생성 안 하고 확장**함.
- **poi_feedback**: recommend/caution, `unique(poi_id,user_id)`, RLS(읽기 전체/쓰기 본인) + `poi_feedback_poi_idx`.
- **카운트**: `pois.recommend_count`/`caution_count` 신규 + `bump_poi_feedback_counts()` SECURITY DEFINER 트리거(insert/update전환/delete 모두 처리).
- **reports 확장**: `report_target`에 `POI` 값 추가, `status`(open/resolved/dismissed default open)+`resolved_at` 추가.
- **RPC**: `set_poi_feedback(p_poi,p_type)` → (recommend_count,caution_count,my_feedback) 반환, null이면 해제; `create_report(p_target_type,p_target,p_reason)` → reports 행(reason 1..1000 필수).
- **read 정책**: `pois`를 `USING (review_status='approved')`로 교체(B1 이월 완료).
- **검증됨(Peter JWT+ROLLBACK)**: recommend(1/0)→caution 전환(0/1)→해제(0/0), POI 신고(target=POI,status=open,mine=t), 멱등 recommend(1→1 유지), INVALID_FEEDBACK_TYPE·INVALID_REASON·POI_NOT_FOUND·UNAUTHENTICATED 가드. gen:types + typecheck exit 0.

---

## 🔴 Tier C — 나중(큼, 오늘 X)
- ✅ **C2 완료** (2026-07-01, commit `6b8eb43`) — 발행본=여정 스냅샷 분리. `published_routes`+`published_route_spots`(발행 시점 동결 복사본) + `publish_snapshot`/`unpublish_snapshot` RPC(스냅샷 생성·갱신 + visibility 동기화, idempotent). RLS 공개읽기 + anon/authenticated SELECT grant. **비파괴적**: 기존 visibility feed 유지. 검증(Peter JWT+ROLLBACK): 발행(snap=1,spots=4), **여정 수정에도 스냅샷 동결**, 멱등 재발행, 해제→PRIVATE, NOT_OWNER/UNAUTHENTICATED. gen:types+typecheck exit 0.
  - ☐ C2b(후속): feed/import/social 리더를 스냅샷 테이블로 이관(현재는 visibility 기반 유지).
- ✅ **C1 완료** (2026-07-01, commit `6e8f3fb`) — 라우팅 엔진 어댑터 골격. `src/features/routing/`: `RoutingProvider` 인터페이스 + provider-neutral 타입 + 순수 `createRoutingOrchestrator`(3-tier first-non-null fallback). 프로바이더: `StraightLineProvider`(작동 폴백, haversine+estimated), `GraphHopperProvider`(골격: 순수 URL빌더/응답파서 테스트됨, 네트워크는 `EXPO_PUBLIC_GRAPHHOPPER_URL` 미설정 시 null), `StoredCourseProvider`(DI lookup, 미주입 시 inert). `createRouter`+`ROUTING_CONFIG`+기본 `router`. routing.test 28 assertion(총 70). typecheck exit 0.
  - ☐ C1b(후속): 자체호스팅 GraphHopper 컨테이너 + `StoredCourseProvider`의 Supabase lookup 실구현 → tier1/2 활성화.
- ✅ **C3 완료** (2026-07-01, commit `5ae4e3e`) — 모더레이션 어드민. `admin_users` 테이블(deny-all RLS; **admin 플래그를 profiles에 안 둔 이유**=`update own profile` 정책로 인한 self-escalation 방지) + `is_admin()` definer 헬퍼. 관리자 RPC(자체 gate): `review_poi`(approved/pending/rejected), `resolve_report`(resolved/dismissed+resolved_at), `admin_list_pending_pois`/`admin_list_open_reports`(공개 RLS가 숨기는 행을 definer로 조회). B2 모더레이션 실운영화. Peter-as-admin+ROLLBACK 검증: is_admin, pending/open 큐, 승인+해결, FORBIDDEN(비관리자), INVALID_STATUS. gen:types+typecheck exit 0.

🎉 **Tier C(C1·C2·C3) 전부 완료.** 비교 분석 기반 A/B/C 모든 tier 이식 완료. 남은 후속(C1b·C2b·진입점 UI)은 각 항목에 명시.

---

## ✅ 커밋 규칙
- 개인 프로젝트 → 팀 vault/GitLab 기록 금지. 이 저장소(GitHub `abfishlee/ridekorea_b`)에만.
- 항목 단위 커밋: `feat(ride): pure ride-metrics + GPS jump guard + tests` 등.
- 비밀번호·토큰 평문 금지(`.env`는 `.gitignore`).
