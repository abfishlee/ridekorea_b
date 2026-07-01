# 10. 개발 Phase & 진행 트래커 (Development Phases & Progress)

> 너(사용자)와 나(Claude)가 **한 작업씩** 진행하는 살아있는 트래커. 매 작업 후 상태와 진행률을 갱신한다.
> 상태 표기: ✅ 완료 · ◐ 진행/부분 · ☐ 대기

## 📊 진행률 요약 (Overall ≈ 79%)

| Phase | 내용 | 상태 | 진행률 |
|---|---|---|---|
| 0 | 기획·아키텍처·UI/UX 문서 | ✅ | 100% |
| **1** | **DB & 백엔드 코어** | ◐ | **90%** |
| 2 | 모바일 앱 스켈레톤 | ✅ | 100% |
| 3 | Explore & Route Detail | ✅ | 100% |
| 4 | Ride 코어(추적·이탈·사진핀) | ✅ | 100% |
| 5 | 지오펜싱 & 바우처 | ◐ | 67% |
| 6 | Diary & 소셜 | ◐ | 50% |
| 7 | 스탬프·물류·ETL | ◐ | 33% |
| 8 | 하드닝 & 출시 준비 | ◐ | 25% |

**완료 작업: 26 / 33** → **약 79%**

> 🟢 **로컬 Supabase 스택 구동·검증 완료** (Docker): 마이그레이션 2종 + seed 적용, 데이터 확인(routes 2·spots 4·vouchers 2·regions 1·인증센터 3·pois 3·profiles 1).
> 🟢 **피드 쿼리 end-to-end 검증** (3.1): anon/authenticated GRANT 추가 + 임베드 FK 명시 후 실 데이터 조회 성공.
> 🟢 **핵심 플로우 RPC 검증** (3.2, 인증 JWT): `import_route`→PRIVATE/DRAFT 복제 생성, `toggle_like`→♥ 증가(트리거 작동) 확인.
> 🟢 **라이딩 종료 RPC 검증** (4.5, 피터 권한): 공식루트 import→`finalize_ride`(합성 track/deviated GeoJSON)→**FINISHED + track/deviated 지오메트리 저장 + 거리 4511.7m 서버계산 + 프로필 누적거리 갱신** 확인(트랜잭션 ROLLBACK으로 시드 무손).
> 🟢 **특정 루트 라이딩 플로우 완성** (4.1): 루트 상세 → 계획 경로 전달 → 이탈 감지(파랑→분홍) → 종료 시 `finalize_ride` 저장까지 UI 연결. 구성 RPC 3종(`import_route`·`route_path_geojson`·`finalize_ride`) 개별 검증 완료. 통합 DB 재검증은 Docker 기동 시 1회 확인 예정.
> 🟢 **사진핀 RPC 검증** (4.4, 피터 권한): `add_ride_spot`→소유 루트에 Point(SRID4326)·photo_url·spot_type 스팟 생성 확인. Storage 버킷 `ride-photos`(공개읽기+소유자 쓰기) 생성 확인.
> 🟢 **지오펜싱/바우처 RPC 검증** (5.1, 피터 권한): `nearby_regions_geojson`→부여 근처 1건(MultiPolygon)·반경 밖 0건. `claim_voucher`→발급(ISSUED)·재고 차감·중복(ALREADY_CLAIMED)·지역밖(OUTSIDE_REGION) 차단 확인.
> 🟢 **스탬프 RPC 검증** (7.1, 피터 권한): `certification_centers_geojson`→3곳. `award_stamp`→100m 근접 발급·재발급 멱등·150m 밖(TOO_FAR) 차단 확인. `buildPassport` 순수 8/8.
> 🟢 **소셜 RPC 검증** (6.2/6.3, 피터 권한): `publish_route`→PRIVATE↔PUBLIC 전환·남의 루트(NOT_OWNER) 차단. `add_comment`→작성 시 comments_count +1(트리거)·삭제 시 복원·빈본문(INVALID_BODY) 차단 확인.
> 🟢 **바우처 사용 RPC 검증** (5.3, 피터 권한): `redeem_voucher`→ISSUED→REDEEMED(redeemed_at 설정)·이중사용·없는 claim(NOT_REDEEMABLE) 차단. Wallet 임베드 쿼리(claims+voucher+region) REST 200 확인. ✅ **전 RPC 검증 완료**.
> 🟢 **콜드스타트 시딩** (8.3): 개척자 라이더 3명(Yuki🇯🇵·Lena🇩🇪·Mateo🇪🇸) 공개 여행기 3개 + 스팟 9개 시드 → 피드에 **공개 USER 루트 4개(4국적)·스팟 13개**. seed.sql 편입(멱등).

---

## 🤝 협업 방식
- 한 번에 **한 작업(Task)**만 진행한다. 끝나면 이 문서의 상태/진행률을 갱신하고 다음 작업을 제시한다.
- 각 Task는 *산출물 / 파일 / 완료 기준(AC)*을 갖는다. 너가 "다음" 하면 이어서 진행.

---

## Phase 0 — Foundation (기획) ✅
- ✅ 0.1 비전·시나리오 문서 (`0`,`1`)
- ✅ 0.2 기술/DB 모델·아키텍처·지도 비용 전략 (`2`,`4`,`8`)
- ✅ 0.3 디자인·UI/UX 명세 (`3`,`9`)

## Phase 1 — Database & Backend Core ◐ (90%)
- ✅ **1.1 스키마 마이그레이션** — `supabase/migrations/20260630100000_init_schema.sql`
  - AC: enums·전 테이블·인덱스·RLS·트리거(handle_new_user, bump_counts) 포함, `5_database_schema_sql.md`와 일치.
- ✅ 1.2 RPC 마이그레이션 — `supabase/migrations/20260630120000_rpc_functions.sql` (6 RPC)
- ✅ **1.3 시드 데이터** — `supabase/seed.sql` (서울–부산 공식 루트 1, 샘플 Rider Story 1, 부여군 region+voucher, 인증센터 일부, POI 샘플)
- ◐ 1.4 Edge Functions — 스켈레톤 6종 작성 완료(✅). 로컬 스택 가동 중이라 `supabase functions serve`/`deploy` 가능, 통합 테스트만 대기
- ✅ 1.5 타입 생성 — 라이브 로컬 DB에서 `src/types/database.ts` 생성(1799줄)

## Phase 2 — Mobile App Skeleton ✅ (100%)
- ✅ 2.1 Expo 프로젝트 init + 의존성 — **Expo SDK 56** + expo-router, 의존성 22종(zustand·react-query·supabase-js·expo-location·expo-sqlite·expo-font·i18next 등), 부팅 스캐폴드(`app/_layout.tsx`,`app/index.tsx`,`app.json`,`babel.config.js`,`tsconfig.json`)
- ✅ 2.2 디자인 토큰 + 폰트 + i18n — `src/theme/theme.ts`(컬러·간격·터치 토큰), `src/theme/fonts.ts`(Inter+Noto JP/SC/KR 다국어 로딩), `src/i18n/`(en/ja/zh/ko 4종 + 로컬 감지). _layout에 폰트·스플래시·SafeArea 연결. 타입체크 통과(exit=0).
- ✅ 2.3 Supabase 클라이언트 + 구글 로그인 + 권한 프라이밍 — `src/lib/supabase.ts`(AsyncStorage 세션), `src/lib/auth.ts`(구글 OAuth 브라우저 플로우), `src/stores/auth.ts`(zustand, 애플은 stub), `app/login.tsx`(로그인 화면), `_layout`에 Provider+보호라우팅, 권한 유틸·프라이밍 카피. 타입체크 통과.
- ✅ 2.4 하단 탭 4개 + 화면 스텁 — `app/(tabs)/_layout.tsx`(Explore/Ride/Diary/Wallet, Ionicons), 4개 탭 화면 + `ScreenStub` 컴포넌트. 인증 후 탭 진입 라우팅 연결. 타입체크 통과.

## Phase 3 — Explore & Route Detail ✅ (100%)
- ✅ 3.1 Explore 피드 — `src/features/explore/`(fetchFeed+useFeed 쿼리, RouteCard, 포맷터), `app/(tabs)/index.tsx`(Rider Stories/Official 토글 + FlatList + 로딩/빈/에러 상태 + 당겨서 새로고침). `.env` 자동설정. **실 DB 조회 검증 완료**(GRANT 누락 + 임베드 FK 모호성 2건 수정).
- ✅ 3.2 Route Detail — `src/features/route/api.ts`(상세 쿼리 + `import_route`/`toggle_like` mutation), `app/route/[id].tsx`(커버·통계·요약·소셜·**여정 타임라인**·`[Make it my route]`). 카드→상세 라우팅 연결, spot_type enum 정합. **RPC 두 개 인증 컨텍스트 검증 완료**.
- ✅ 3.3 지도 어댑터 — `route_path_geojson` RPC(경로를 GeoJSON으로, RLS 준수), `src/lib/naverMap.ts`(Web Dynamic Map HTML 빌더, 비용최소 전략), `src/features/route/RouteMap.tsx`(WebView + 키 없을 때 폴백). 상세에 루트 폴리라인 표시. 타입체크 통과 + RPC 검증(LineString 반환).

## Phase 4 — Ride Core ✅ (100%)
- ✅ 4.1 네이티브 네이버 지도(Ride) + 글래스 대시보드 + **특정 루트 라이딩** — **화면 완성**: `app/(tabs)/ride.tsx`(자유 라이딩 + **루트 라이딩** 시작/일시정지/종료), `GlassDashboard.tsx`(속도·거리·시간·정상/이탈 배지), `RideMap.tsx`(WebView 라이브 지도: `buildRideMapHtml`—지도 1회 로드 후 증분 갱신으로 **재로드 없음=과금 안전**, 파란/분홍 트랙), `RideMap.web.tsx`(웹 폴백).
  - **루트 라이딩 플로우(신규)**: 루트 상세 `[Ride this route]`(소유 루트) 또는 `[Make it my route]`→가져오기 후 `[Ride now]` → Ride 화면이 `?routeId=`로 계획 경로(`route_path_geojson`)를 받아 지도에 표시 + **이탈 감지(파랑→분홍) 작동**, 종료 시 `finalizeAndClear`→`finalize_ride`로 서버 저장(FINISHED). 소유자 아님/짧은 트랙 등 실패는 로컬 보존 + 안내. 타입체크 통과(exit=0).
  - *(네이티브 Naver SDK로의 교체는 선택적 최적화→백로그)*
- ✅ 4.2 위치 추적 + SQLite 아웃박스 + 배치 동기화 — `track.ts`(순수 누적기 11/11), `outbox.ts`(expo-sqlite 영속, 웹은 비치명적 폴백), `stores/ride.ts`(watchPositionAsync→누적기→아웃박스 + 지도용 getter). 타입체크 통과.
- ✅ 4.3 이탈 감지(Blue→Pink, 히스테리시스) — `src/features/ride/deviation.ts` (점↔폴리라인 거리 + 진입40m/이탈25m 히스테리시스). 합성 GPS 5포인트로 전환 시퀀스 검증 완료(5/5 pass).
- ✅ 4.4 사진핀 캡처 + 업로드 파이프라인 — **캡처 UI 완성**: `expo-image-picker`로 카메라→`queueRidePhoto`(Ride 화면 📷 버튼). 백엔드(Storage 버킷 + `add_ride_spot` + 업로드/동기화)는 이미 검증 완료. app.json 권한 플러그인 추가.
- ✅ 4.5 라이딩 종료 → finalize-ride — `src/features/ride/api.ts`(`submitFinalizeRide`/`finalizeAndClear`/`useFinalizeRide`: stop 페이로드→`finalize_ride` RPC→성공 시 아웃박스 정리, 실패 시 보존). **로컬 DB end-to-end 검증 완료**(FINISHED·지오메트리·거리·프로필 누적).

## Phase 5 — Geofencing & Vouchers ◐
- ✅ 5.1 지역 지오펜싱(주변 region 캐시 + ENTER 감지) — `src/features/geofence/geofence.ts`(순수: 레이캐스팅 점-인-폴리곤 + 홀 + MultiPolygon + ENTER/EXIT 전환 + 디바운스, **합성 13/13 검증**), `supabase/migrations/20260630170000_regions_geojson.sql`(`nearby_regions_geojson` RPC), `src/features/geofence/api.ts`(`fetchNearbyRegions`→GeofenceRegion[], `claimVoucher`/`useClaimVoucher`). **로컬 DB 검증 완료**.
- ◐ 5.2 claim-voucher 연동 + VoucherCard(스프링 등장) — `claim_voucher` API/RPC **검증 완료**(발급·중복·지역밖). VoucherCard UI는 대기.
- ◐ 5.3 Wallet(바우처/상태) — **백엔드 완료**: `src/features/wallet/api.ts`(`fetchMyClaims`+임베드, `useRedeemVoucher`). `redeem_voucher` 로컬 DB 검증. Wallet 화면 UI는 대기.

## Phase 6 — Diary & Social ◐
- ☐ 6.1 Diary 타임라인 + My Journeys
- ✅ 6.2 Publish(PRIVATE→PUBLIC) — `supabase/migrations/20260630190000_social.sql`(`publish_route` RPC, 소유자 체크), `src/features/route/social.ts`(`usePublishRoute`). **로컬 DB 검증**(전환·NOT_OWNER). 여행기 발행=콜드스타트 해소 핵심.
- ◐ 6.3 좋아요/댓글 — `toggle_like`(3.2 완료) + **댓글 백엔드 완료**: `add_comment` RPC + `useComments`/`useAddComment`/`useDeleteComment`(`social.ts`). 로컬 DB 검증(트리거·INVALID_BODY). 댓글 UI는 상세화면에 추가 대기.

## Phase 7 — Stamps · Logistics · ETL ◐
- ✅ 7.1 스탬프 패스포트 + award-stamp — `supabase/migrations/20260630180000_cert_centers.sql`(`certification_centers_geojson` RPC), `src/features/stamps/passport.ts`(순수 `buildPassport`: 센터×스탬프 조인 + 강별 진행률, **8/8 검증**), `src/features/stamps/api.ts`(센터 목록·내 스탬프·`awardStamp`/`useAwardStamp`). **로컬 DB 검증**(근접 발급·멱등·TOO_FAR).
- ☐ 7.2 물류 가이드 보드(logistics_tips)
- ☐ 7.3 FastAPI 월간 ETL(파일럿 POI → pois upsert)

## Phase 8 — Hardening & Launch ◐
- ☐ 8.1 다국어 완성(EN/JP/ZH/KO)
- ☐ 8.2 모더레이션(reports) + 개인정보/권한 고지
- ✅ 8.3 오프라인 폴리시 + 콜드스타트 시딩 — 오프라인=아웃박스(4.2 완료). **콜드스타트 시딩 완료**: `supabase/seed.sql`에 개척자 여행기 3개(Yuki/Lena/Mateo, 커버·스팟 사진 포함) 추가 → 피드 4개국 여행기.
- ☐ 8.4 EAS 빌드 + 스토어 제출 준비

---

## 🎯 현재 포커스
- **방금 완료**: ✅ **Phase 4 완성(100%)** — "특정 루트 라이딩" 플로우 연결(루트 상세 → 계획 경로 전달 → 이탈 감지 파랑→분홍 → 종료 시 `finalize_ride` 서버 저장). `app/(tabs)/ride.tsx` + `app/route/[id].tsx` 수정, 타입체크 통과(exit=0). *(구성 RPC 3종 개별 검증 완료; 통합 DB 재검증은 Docker 기동 시 1회 확인 예정)*
- **📦 너의 EAS 빌드 단계(준비되면)**: `npm i -g eas-cli` → `eas login` → `eas init`(projectId 생성) → `eas build -p android --profile development` → APK 설치 → `npx expo start --dev-client`. 지도는 기존 웹 Dynamic Map 키 그대로 사용(네이티브 SDK 키 불필요, localhost 허용만).
- **다음 → ① 웹 Ride 화면 미리보기**(브라우저에서 Ride 화면 시각 확인 + `RideMap.web` 실지도화) — *Docker + Metro 기동 필요*. 이후 **5.2 VoucherCard UI → 5.3 Wallet UI → 6.1 Diary(내 여정)** 순.
- **📌 백로그(나중 폴리시)**:
  - 스팟 마커 디자인 — **사진 있으면 원형 사진 마커**(돋보기 스타일), **글만 있으면 이모지**. (`route_spots_geojson`에 photo_url 추가 + 마커 content를 원형 이미지로)
  - 지도 마커 **밀집 구간 클러스터링** — 줌아웃·밀집 시 근접 마커를 하나로 묶어 개수 배지 표시, 줌인·탭 시 해제. (네이버 지도 MarkerClustering 라이브러리 또는 자체 그리드 클러스터링)
  - **Ride 지도 네이티브 Naver SDK 교체**(성능 최적화): 현재 WebView 라이브 지도로 충분, 고빈도 실시간이 필요해지면 `@mj-studio/react-native-naver-map` 도입.
  - `claim_voucher` 설계 주의점: 현재 `order by created_at limit 1`로 **첫 바우처만 발급**(2번째 바우처 도달 불가). 지역당 다중 바우처/선택 발급 필요 시 개선.
- **💸 비용 주의**: 지도(네이버) 미리보기는 호출당 과금 → 충분히 개발 후 한 번에 확인.
