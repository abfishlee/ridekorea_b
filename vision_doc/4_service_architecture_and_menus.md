# 4. 서비스 아키텍처 및 메뉴 구조 (Service Architecture & Menus)

## 📱 하단 탭 내비게이션 (Bottom Tabs)

사용자의 여정(Before → During → After)을 커버하는 4개 메인 탭.

### 🔍 1. Explore (탐색) — *Before Ride*
종단 루트를 검색하고 피터의 기행문을 발견하는 탭.
* **추천 루트(Feed)**: 공개 기행문(루트+사진+메모)을 인스타그램 피드처럼 나열. 데이터: `routes`(visibility=PUBLIC) + 대표 `spots`/`likes_count`.
* **물류 가이드(Logistics Tips)**: 공항→출발지 이동, 자전거 포장법 등. 데이터: `logistics_tips` 게시판.
* **Action**: `[나의 경로로 가져오기]` → Edge Function `import_route`(source_route_id) 호출 → 내 소유 PRIVATE route 생성.

### 🚴 2. Ride (주행) — *During Ride*
네이버 지도 기반 실시간 주행 화면(핵심).
* **Full-Screen Map**(네이티브 SDK): 정상 궤적=Aero Blue, 이탈 개척로=Adventure Pink.
* **Floating Dashboard**: 현재 속도·주행 거리·고도(반투명 글래스).
* **Photo Pin Button**(우하단 대형): 누르면 카메라 → 촬영 시 **현재 GPS 좌표에 핀**. 사진/메모는 **로컬 아웃박스에 먼저 저장**(오프라인 안전), 온라인 시 Storage 업로드 + `spots` insert.
* **Voucher Card**: 바우처 권역 진입 시 하단에서 카드가 애니메이션으로 등장.

### 📖 3. Diary (기록) — *After Ride*
주행 종료 후 내 궤적·사진핀을 모아 기행문을 감상·편집.
* **My Journeys**: 내 라이딩(Blue+Pink) + 위치별 사진·메모를 타임라인으로.
* **Publish/Share**: 비공개(PRIVATE) 라이딩을 공개(PUBLIC) 기행문으로 발행하거나 외부 공유.

### 🎫 4. Wallet (지갑) — *Local Economy*
모아둔 지역 쿠폰과 종주 스탬프 관리.
* **보유 바우처**: `voucher_claims` 리스트(바코드/QR + 사용 상태).
* **스탬프 패스포트**: `stamps` — 인증센터 통과 시 찍힌 디지털 종주 여권.

---

## ⚙️ 시스템 동작 흐름 (수정판)

> 상세 알고리즘·의사코드는 `6_core_flows_and_algorithms.md`. 여기서는 책임 분리만 명확히 한다.
> **원칙: 클라이언트는 수집·표시, 서버(Edge Function)는 검증·발급. anon key를 신뢰하지 않는다.**

### A. 주행 추적 (Offline-First)
1. `[Start]` → `expo-location` 백그라운드 태스크 시작. 트랙 포인트를 **SQLite 아웃박스**에 N초 간격으로 기록(클라이언트 UUID 부여 → 멱등).
2. 네트워크가 있을 때만 백그라운드로 Supabase에 배치 업서트. 음영지역에선 로컬에 쌓였다가 복구 시 동기화.
3. ⚠️ (원안의 "5초마다 서버 전송"은 비효율·배터리 문제) → **로컬 우선, 배치 동기화**로 대체.

### B. 사진핀 (수정: 즉시 업로드 ❌ → 아웃박스 ⭕)
1. 촬영 → 사진+좌표+시각을 **로컬 아웃박스**에 저장(즉시 화면엔 낙관적으로 핀 표시).
2. 온라인 시 Storage 업로드 → URL 확보 → `spots` insert. 실패 시 큐에 남아 재시도.

### C. 바우처 (수정: 1분 서버폴링+푸시 ❌ → 클라 지오펜스 + 서버 검증 ⭕)
1. 앱이 **주변 활성 바우처 권역(`regions`/`vouchers`) 폴리곤을 한 번 받아 캐싱**.
2. 클라이언트 **지오펜싱**(`expo-location` region monitoring 또는 turf 포인트-인-폴리곤)으로 **진입(ENTER) 이벤트** 감지. (iOS 동시 모니터링 20개 제한 → 가까운 권역만 등록)
3. 진입 시 Edge Function `claim_voucher(voucher_id, location)` 호출 → 서버가 **실제 위치를 PostGIS `ST_Contains`로 재검증**(스푸핑 방지) + 수량·중복(unique) 확인 → `voucher_claims` 발급 → 클라이언트는 Wallet에 반영.
4. 부정사용 방지: 최근 트랙이 권역을 실제 통과했는지 확인, 유저당 1회(unique), 레이트리밋. (세부: 문서 6 §3)

### D. 라이딩 종료 (Finalize)
1. `[Stop]` → 아웃박스의 남은 항목 플러시.
2. Edge Function `finalize_ride(route_id)` → 트랙 포인트를 `track_geom`(LineString)으로, 이탈 구간을 `deviated_geom`(MultiLineString)으로 조립, 거리=`ST_Length(geography)`, `routes.status='FINISHED'`, `profiles.total_distance_m` 갱신.
3. 화면은 Diary 탭으로 전환되어 방금 주행을 타임라인으로 표시.

### 백엔드 책임 분리 요약
| 책임 | 위치 |
|---|---|
| 인증·DB·스토리지·RLS | Supabase |
| 바우처 발급·루트 가져오기·좋아요·종료 집계(트랜잭션/검증) | Supabase **Edge Function** |
| 월 1회 공공데이터 ETL → `pois` upsert | **FastAPI** 배치 |
| 실시간 궤적 렌더 | App(네이티브 지도) |
