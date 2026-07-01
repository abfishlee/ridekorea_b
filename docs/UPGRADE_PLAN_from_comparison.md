# 🚀 반영 고도화 플랜 (비교 분석 기반)

> 근거: `docs/COMPARISON_with_RideKorea.md` · 목표: Tier A 완주 + Tier B 스캐폴딩.
> 규칙: 한 번에 하나씩 → `npm run typecheck`(exit 0) → 가능하면 로컬 Supabase 검증 → **커밋·push + 이 MD에 완료 표기**.

## 📌 진행 로그
- ✅ **A1 완료** (2026-07-01, commit `83481a7`) — `track.ts` GPS 점프 가드(`maxJumpM`/`maxJumpGapS`) + 순수 `ride-metrics.ts`(`summarizeTrack`) + `ride-metrics.test.ts` 17 assertion 통과 + 스토어 `start/recover`에 `maxJumpM=500` 배선 + `npm run test:cores` 스크립트. typecheck exit 0. (문서 커밋 `2489987`… 실제 A1 코드 `83481a7`)
- ☐ A2 — 복구 outbox 방어검증 (다음)
- ☐ A3 — 지도 프로바이더 인터페이스(Naver)
- ☐ B1 — POI 출처·라이선스·물류 마이그레이션
- ☐ B2 — feedback/report 테이블 + RPC

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

### A2. 복구 outbox 방어검증
- **대상(신규)**: `src/features/ride/outbox-validate.ts` — 순수 `isValidLngLat(v)`, `sanitizePlannedLine(raw): LngLat[]`.
- **대상(수정)**: `src/stores/ride.ts` `recover()` — `plannedGeoJSON` 파싱과 저장 포인트 hydrate 전에 sanitize 적용(손상 데이터 → 빈/필터 처리, 크래시 없음).
- **AC**: 일부러 깨진 좌표/비배열 주입해도 복구가 안전하게 동작. typecheck 그린.

### A3. 지도 프로바이더 인터페이스 (Naver 구현, Phase 1)
- **대상(신규)**:
  - `src/map/types.ts` — `LngLat`, `RoutePath{id,coordinates,color,widthPx,dashed}`, `MapMarker`, `MapEvent`, `MapLanguage`.
  - `src/map/MapProvider.ts` — `interface MapProvider{ id; supportsOffline; hasKoreanRoadDetail; init; setRoutes; setPosition; setMarkers; moveCamera; fitBounds; on }`.
  - `src/map/providers/NaverWebViewProvider.ts` — **기존** `buildRideMapHtml` + `injectJavaScript` 증분갱신을 이 계약으로 래핑(재로드 없음=과금 안전 유지).
  - `src/map/index.ts` — `createMapProvider(deps, which='naver')` 팩토리 + `MAP_CONFIG{ primary:'naver', naverClientId, secondary:'mapbox' }`.
- **주의**: 기존 `RideMap.tsx`/`RouteMap.tsx`는 **유지**. 오늘은 인터페이스+Naver impl만. 화면 이관은 다음 단계(점진).
- **AC**: typecheck 그린, 기존 화면 동작 불변. (Mapbox/Google은 TODO stub로 인터페이스만.)

---

## 🟡 Tier B — 스캐폴딩(Docker/Supabase 필요)

### B1. POI 출처·라이선스·물류 마이그레이션
- **선행**: `\d pois`로 기존 컬럼 확인(중복 회피).
- **대상(신규)**: `supabase/migrations/<ts>_poi_provenance_logistics.sql`
  `ALTER TABLE pois ADD COLUMN IF NOT EXISTS` — `source text, source_url text, source_name text,
  license_type text, attribution text, retrieved_at timestamptz, external_id text, review_status text default 'approved',
  transport_mode text, bike_policy text, bike_policy_en text, packing_required boolean, packing_notes text, packing_notes_en text, booking_url text`.
  + `external_id` unique 인덱스(재동기화 upsert 키).
- **검증**: `supabase migration up` → `npm run gen:types` → 조회 RPC/뷰에 필드 노출 확인.
- **AC**: 마이그레이션 성공 + 타입 재생성 반영.

### B2. feedback/report 테이블 + RPC (8.2 모더레이션 시작)
- **대상(신규)**: `supabase/migrations/<ts>_moderation.sql`
  - `poi_feedback(id, poi_id, user_id, feedback_type check in('recommend','caution'), created_at, unique(poi_id,user_id))`
  - `reports(id, target_type, target_id, user_id, report_type check in('closed','wrong_location','danger','other'), note, status default 'open', created_at, resolved_at)`
  - RLS(작성자 본인 + 공개 읽기 정책) + `pois.recommend_count/caution_count` 카운트 트리거.
  - RPC: `set_poi_feedback(p_poi uuid, p_type text)`, `create_report(p_target_type text, p_target uuid, p_type text, p_note text)`.
- **검증(피터 JWT, ROLLBACK 래핑)**: 발급/토글/중복 unique/카운트 트리거/빈 note 차단.
- **AC**: 로컬 DB 검증 통과 + 타입 재생성.

---

## 🔴 Tier C — 나중(큼, 오늘 X)
- **라우팅 엔진 어댑터**: `RoutingProvider` 인터페이스 + GraphHopper 얇은 어댑터(A안 `osm_bike.py` 참고). 자체 호스팅 GraphHopper 컨테이너 필요 → 별도 스프린트.
- **발행본=여정 스냅샷 분리**: 현재 단일 `routes`+visibility → 발행 시 스냅샷 테이블 분리(A안 `SharedRoute/SharedRouteStop`).
- **어드민 surface**: VoucherConfig 편집 등.

---

## ✅ 커밋 규칙
- 개인 프로젝트 → 팀 vault/GitLab 기록 금지. 이 저장소(GitHub `abfishlee/ridekorea_b`)에만.
- 항목 단위 커밋: `feat(ride): pure ride-metrics + GPS jump guard + tests` 등.
- 비밀번호·토큰 평문 금지(`.env`는 `.gitignore`).
