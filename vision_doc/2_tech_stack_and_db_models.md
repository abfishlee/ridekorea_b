# 2. 기술 스택 및 데이터 모델 (Tech Stack & Data Model)

## 🛠 하이브리드 기술 스택

개발 속도 극대화와 인프라 관리 최소화를 위해 BaaS(Supabase) 중심의 하이브리드 구조를 채택한다.

### 1. Frontend (Mobile App)
* **Framework**: React Native + **Expo (Dev Client / EAS Build)**.
  * ⚠️ 네이티브 지도 SDK·백그라운드 위치를 쓰므로 **Expo Go에서는 동작하지 않는다.** 처음부터 Dev Client + EAS Build로 개발한다.
* **Language**: TypeScript
* **State**: Zustand(전역 UI 상태) + TanStack Query(서버 상태·캐싱)
* **Local DB / Outbox**: `expo-sqlite` (오프라인 아웃박스 큐: 트랙 포인트·사진·메모)
* **Location**: `expo-location` (Foreground + Background task, Geofencing)

### 2. Map Engine (중요 — 비용 의사결정 필요)
1차 후보는 네이버다. 단, **두 가지를 정확히 알고 선택**한다.
* **`@mj-studio/react-native-naver-map`(네이티브 SDK = Mobile Dynamic Map)**: 실시간 궤적·커스텀 마커 렌더 성능이 좋아 **Ride 화면에 적합**. 그러나 **무료 이용량이 없어 첫 호출부터 과금**된다.
* **Web Dynamic Map(WebView)**: **무료 이용량 대상**이라 비용이 싸지만 실시간 렌더 성능은 떨어짐 → **Explore/Diary의 정적 지도·썸네일에 적합.**
* **권장 전략(비용 최소화)**: Ride 화면만 네이티브 SDK, Explore/Diary는 Web Dynamic Map 또는 Static Map. 콘솔에서 일/월 이용 상한선을 설정한다. (네이버는 자전거 *전용 라우팅/경사도 레이어*를 SDK로 제공하지 않으므로, 경사도·고도는 자체 데이터(GPS 고도 또는 공공데이터)로 계산한다.)
* 지도 제공자가 바뀔 수 있으므로(구글 한국 내비 출시 대기 등) 지도 호출은 얇은 래퍼로 감싸 교체 가능하게 둔다.

### 3. Main Backend (BaaS) — Supabase
* **Auth**: 구글/애플 소셜 로그인 (`signInWithIdToken`)
* **Database**: PostgreSQL + **PostGIS** (공간 데이터)
* **Storage**: 여행 사진(원본은 Storage, 표시용 썸네일은 변환 후 사용)
* **Edge Functions(Deno/TS)**: 트랜잭션·검증 로직(바우처 발급, 루트 가져오기, 좋아요 토글, 라이딩 종료 집계). service role로 RLS를 우회해 안전하게 처리.
* **Realtime**: (post-MVP) 친구 라이딩 궤적 실시간 확인.

### 4. Sub Backend (Data Processor) — Python (FastAPI)
* **유일한 역할**: **월 1회 공공데이터 ETL 배치.** 식당·자전거 수리소·기차역·캠핑장·인증센터 등을 공공데이터(자전거길 DB·TourAPI·고캠핑 등)에서 수집·정규화해 Supabase `pois` 테이블에 upsert.
* 트랜잭션성 사용자 로직을 FastAPI에 두지 않는다(그건 Edge Function 담당). 두 백엔드의 책임이 겹치지 않게 한다.
* 상세 소스/엔드포인트와 갱신 파이프라인: `7_mvp_scope_and_roadmap.md` 및 데이터 소스 절 참조.

---

## 🗄️ 개념 데이터 모델 (Conceptual ERD)

> 권위 있는 DDL·RLS·트리거·인덱스는 `5_database_schema_sql.md`에 있다. 여기서는 엔티티와 관계만 설명한다.

### 핵심 통합 모델: "모든 것은 route다"
공식 루트, 가져온 루트, 진행 중 라이딩, 발행된 기행문을 **하나의 `routes` 테이블**로 표현한다(불필요한 테이블 분리를 피해 MVP를 단순화).

* `routes.type` = `OFFICIAL`(앱 제공) | `USER`(유저 생성)
* `routes.visibility` = `PRIVATE` | `PUBLIC`
* `routes.status` = `DRAFT` | `ACTIVE`(주행 중) | `FINISHED`
* `routes.source_route_id` = 가져오기(import) 계보. 사사키가 피터의 루트를 가져오면, 사사키 소유의 새 `USER/PRIVATE` route가 만들어지고 `source_route_id`가 피터 route를 가리킨다.
* `routes.planned_geom`(LineString) = 따라갈 계획 경로 / `track_geom`(LineString) = 실제 주행 궤적 / `deviated_geom`(MultiLineString) = 분홍색 개척로.

### 엔티티 요약

| 테이블 | 역할 | 핵심 관계 |
|---|---|---|
| `profiles` | 유저 프로필(auth.users 확장) | `id` ← `auth.users.id` |
| `routes` | 공식/유저 루트·라이딩·기행문 통합 | `author_id`→profiles, `source_route_id`→routes |
| `spots` | 주행 중 사진+메모 핀 | `route_id`→routes, `user_id`→profiles |
| `likes` | 루트 좋아요(유저별 1회) | unique(`route_id`,`user_id`) |
| `comments` | 루트 댓글 | `route_id`→routes |
| `logistics_tips` | 공항 점프·포장법 등 커뮤니티 게시판 | `author_id`→profiles |
| `regions` | 도/시 경계(지오펜스·바우처 권역) | `boundary`(MultiPolygon) |
| `vouchers` | 지역 한정 제휴 쿠폰(오퍼) | `region_id`→regions |
| `voucher_claims` | 유저가 발급/사용한 쿠폰(지갑) | unique(`voucher_id`,`user_id`) |
| `certification_centers` | 국토종주 인증센터 | `location`(Point) |
| `stamps` | 디지털 종주 스탬프 | unique(`user_id`,`center_id`) |
| `pois` | 공공데이터 POI(식당·수리소·숙박…) | FastAPI ETL이 upsert |
| `reports` | 신고/모더레이션 | 다형(target_type,target_id) |

### 사사키 시나리오 → 데이터 매핑
- 피터 기행문 = `routes`(USER/PUBLIC) + 그에 달린 `spots`/`likes`/`comments`
- "나의 루트로 가져오기" = 새 `routes`(USER/PRIVATE, source_route_id=피터) 생성
- 주행 시작 = 그 route를 `ACTIVE`로, 트랙 포인트는 로컬 아웃박스 → 동기화
- 사진핀 = `spots` insert(Point + photo_url + memo)
- 부여군 진입 바우처 = `regions`(부여군) 지오펜스 → Edge Function이 `voucher_claims` 발급
- 종단 스탬프 = `certification_centers` 근접 → `stamps`
