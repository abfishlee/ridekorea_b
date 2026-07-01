# 9. UI/UX 명세 (Scenario-Driven UI/UX Spec)

> `0_sasaki_scenario.md`의 여정을 화면 단위로 구현 가능한 수준으로 분해한다.
> 디자인 토큰·색·타이포는 `3_design_philosophy_and_standards.md`를 따른다.
> 핵심 감정 곡선: **막막함 → 발견의 설렘 → 안심 → 몰입(기행문) → 뜻밖의 보상.**

---

## 0. 정보 구조 (IA)

```
[Onboarding] → [App]
 App = Bottom Tabs:
   ① Explore (탐색)   ② Ride (주행)   ③ Diary (기록)   ④ Wallet (지갑)
 + 모달/풀스크린: RouteDetail, RideActive, PhotoPinSheet, VoucherCard, Publish
```
탭 바: 4개, 아이콘+라벨, 활성=K-Indigo. 주행 중에는 탭 바를 숨기고 Ride 풀스크린 유지(이탈 방지).

---

## 1. 온보딩 & 로그인 — *시나리오 1단계: 막막함→만남*

**목표:** "복잡한 가입 없이 1초". 좌절하고 온 사용자에게 즉각 안심을 준다.

- **언어 선택(최초 1회)**: EN(기본)/日本語/中文/한국어. 시스템 로캐일 자동 추정 후 확인. 이후 설정에서 변경.
- **가치 한 줄 + 비주얼**: "Cross Korea by bike — guided by riders who've been there." 한국 풍경 사진 풀블리드.
- **로그인 버튼 2개만**: `Continue with Google`, `Continue with Apple`. (이메일/비번 없음) → Supabase `signInWithIdToken`.
- **권한 프라이밍(Pre-permission)**: 시스템 권한 팝업 전, "왜 필요한지"를 먼저 설명하는 화면.
  - 위치: "To record your journey and surprise you with local rewards."
  - 백그라운드 위치/배터리: 주행 시작 직전에 요청(처음부터 다 묻지 않음).
- **엣지케이스**: 로그인 취소→홈 유지. 네트워크 없음→"오프라인입니다. 로그인은 연결 후 가능." 토스트.

마이크로카피 톤: 격려·여행자 친화(명령형 회피). "Let's find your route." 같은 동행자 어조.

---

## 2. Explore (탐색) — *시나리오 2단계: 집단지성 발견*

**목표:** 딱딱한 내비가 아니라 "피터의 기행문"을 발견하게 한다. **Feed가 주인공.**

레이아웃(세로 스크롤):
- 상단: 검색바("Search routes, regions…") + 코스 필터 칩(서울–부산/서울–목포/제주…).
- 세그먼트 토글: **[Official Routes] / [Rider Stories]** — 기본은 **Rider Stories**(UGC가 핵심 매력).
- **루트 카드(인스타 피드형)**:
  - 커버 사진(풀폭, 16:9), 그 위 그라데이션 스크림.
  - 제목("베어링과 함께한 대전 강변 투어"), 작성자 아바타+이름(Peter), 국기.
  - 메타 칩: 거리, 예상 소요, 고도▲, 핀(스팟) 수.
  - 소셜: ♥ likes_count · 💬 comments_count · ↗ share.
  - 우상단 저장 북마크.
- **물류 가이드 진입**: 별도 섹션 카드 "✈️ Getting your bike here" → Logistics Tips 보드.

상태:
- **로딩**: 스켈레톤 카드.
- **빈 상태(콜드스타트 방지)**: 절대 "텅 빔" 금지. 시드 기행문이 항상 보이게. 그래도 비면 "Official routes" 노출 + "Be the first to share a story" CTA.
- **무한 스크롤** + 당겨서 새로고침.

---

## 3. Route Detail (피터의 기행문) — *시나리오 2단계: 가져오기*

**목표:** "이미 종단을 시작한 듯한 설렘"을 만들고 `[가져오기]`로 전환.

스크롤 구조(위→아래 = 출발→도착, 여정을 따라 읽힌다):
1. **Hero**: 커버 사진 + 제목 + 작성자.
2. **요약 바**: 거리 / 예상 소요 / 고도 그래프(미니) / 난이도.
3. **미니 지도**: `planned_geom`(Aero Blue) + 스팟 핀 미리보기. (정적/Web Dynamic Map → 비용 절감)
4. **여정 타임라인(핵심)**: 출발지→도착지 순서로 스팟 카드가 흐른다.
   - 각 스팟: 사진 + 메모 + `spot_type` 아이콘.
   - 예: 🔧REPAIR "타이어 펑크 — 1km 전방에 친절한 수리점", 🍲FOOD "이 국밥집 최고", ⚠️DANGER "A모텔 자전거 반입 거부, 가지 마라". 위험/비추천은 Alert Orange 강조(빨강 배제).
5. **소셜**: 좋아요 토글(→ `toggle-like`), 댓글 리스트/입력, 공유.
6. **하단 고정 CTA 바**: 큰 버튼 `[Make it my route]` → `import-route` → 성공 시 Ride 준비 화면으로.

인터랙션 디테일:
- 스팟 카드 탭 → 지도 위 해당 핀으로 카메라 이동(타임라인↔지도 연동).
- 신고(⋯): 부적절 콘텐츠 `reports`.
- 가져오기 성공 토스트: "Saved to your routes. Ready when you are." + [Start now]/[Later].

---

## 4. 물류 가이드 (Logistics Tips) — *시나리오 3단계: 물류의 벽*

- 보드형 리스트(카테고리: Airport Jump / Packing / Transit / Etc).
- 카드: 제목, 작성자, 업보트, 지역 태그.
- 상세: 본문 + 사진 + 단계(예: "공항철도→서울역→KTX 자전거 거치"). 업보트.
- 진입점: Explore 상단 카드 + 출발 준비 화면에서 "How to reach the start" 링크.

---

## 5. Ride (주행) — *시나리오 4·5·6단계: 핵심 화면*

**목표:** 운동앱이 아니라 "기행문 쓰기". 장갑 끼고도 안전·한눈에.

레이아웃(풀스크린 지도 + 글래스 오버레이):
- **지도**(네이티브 SDK): 현재 위치, `planned_geom`(연한 Aero Blue), 실시간 track(진한 Aero Blue), **이탈(Adventure Pink)**, 스팟 핀.
- **상단 글래스 대시보드**: 큰 숫자 — 현재 속도(tabular-nums) / 주행 거리 / 고도▲. 좌상단 ⏸/⏹.
- **우하단 거대 FAB(60×60+)**: 📷 Photo Pin. 누르면 PhotoPinSheet.
- **하단 진행 바**: 출발→도착 진행률(피터 루트 대비).
- **오프라인 인디케이터**: 음영지역 진입 시 작은 "Saved offline · will sync ☁︎↑N" 배지(불안 대신 안심을 준다).

### 5-1. 시작(Start)
- 출발 준비 화면: 선택한 루트 요약 + "How to reach the start"(물류) + 배터리/백그라운드 위치 권한 마지막 요청 + 큰 `[Start]`.
- 시작 즉시 자동 첫 핀 유도(시나리오: 출발 사진). 토스트: "Tip: snap a photo to mark your start." (강요 아님)

### 5-2. 사진핀 (PhotoPinSheet) — *4단계*
- FAB→카메라 즉시 → 촬영 후 바텀시트:
  - 미리보기 썸네일 + "Title"(예: "드디어 출발") + "Note"(선택) + `spot_type` 칩(자동 추정 가능, 기본 GENERAL).
  - 저장: 로컬 아웃박스에 먼저 → 지도에 즉시 핀(낙관적). 온라인 시 업로드/동기화.
- 마이크로카피: "Pinned to your map." (자동 마크업이 마법처럼 느껴지게)

### 5-3. 이탈의 재해석 (Blue→Pink) — *5단계*
- 이탈 감지(문서6 §2) 시: **경고음·경고색 금지.** 대신 track이 부드럽게 **Adventure Pink**로 전환.
- 작고 긍정적인 토스트(1회, 비침습): "Off the path — exploring your own way ✨"
- 복귀 시 자연스레 Blue로. 종료 후 Diary에서 "My pioneered paths(분홍)"로 별도 강조.

### 5-4. 지역 진입 & 바우처 (VoucherCard) — *6단계: Killer*
- 지역(도/시) 경계 진입 → 상단 슬림 배너 "Welcome to Buyeo-gun 🎉".
- 바우처 활성 권역이면 **하단에서 카드가 스프링 애니메이션으로 등장**:
  - "🎁 A gift for you in Buyeo: Hanwoo gukbap 20% off · Stay ₩10,000 off"
  - `[Add to Wallet]` → `claim-voucher`(서버 위치 재검증) → 성공 시 카드가 Wallet로 날아가는 모션.
  - 실패 처리: ALREADY_CLAIMED→"Already in your wallet", OUTSIDE_REGION→조용히 숨김, NO_VOUCHER→표시 안 함.
- 주행 방해 최소화: 카드는 자동 닫힘(8초) + 한 손 dismiss. 운전 중 결제·복잡 조작 없음.

### 5-5. 종료(Stop)
- ⏹ → 확인 시트("End ride?") → 아웃박스 플러시 → `finalize-ride` → 요약(거리/시간/스팟 수/개척로 길이) → Diary로 전환.

---

## 6. Diary (기록) — *주행 후: 기행문 완성*

- **My Journeys 리스트**: 카드(커버=대표 스팟 사진, 거리/날짜/스팟 수).
- **상세(타임라인)**: 지도(Blue track + Pink 개척로) + 출발→도착 순 스팟(사진+메모) 타임라인. RouteDetail과 동일 포맷(읽는 경험 일관).
- **편집**: 제목/요약/커버 선택, 스팟 메모 수정, 스팟 삭제.
- **발행(Publish)**: PRIVATE→PUBLIC 토글. 발행 전 체크리스트(공개 범위·사진 동의). 발행 시 Explore의 Rider Stories에 등장. "Your story is live — others can now ride it."
- 외부 공유: 대표 이미지+요약 카드 내보내기(인스타 등).

---

## 7. Wallet (지갑) — *로컬 경제*

두 섹션 탭: **Vouchers / Stamps**.
- **Vouchers**: `voucher_claims` 카드 리스트 — 매장명, 혜택, 코드/QR, 유효기간, 상태(ISSUED/REDEEMED/EXPIRED).
  - 사용: `[Show at the counter]` → 코드/QR 확대. (MVP는 사용자 표시형; 매장 정산은 v2)
  - 만료 임박 강조(Alert Orange).
- **Stamps(패스포트)**: 종주 인증센터 스탬프를 여권 비주얼로. 회색 원=미방문, 컬러 스탬프=방문(인증센터 150m 근접 시 `award-stamp`). 코스별 진행률.

---

## 8. 공통 상태·엣지케이스 매트릭스

| 상황 | 처리 |
|---|---|
| 오프라인 | 상단 슬림 배지 + 아웃박스 큐 표시("N items will sync"). 차단하지 말고 계속 기록. |
| 동기화 실패 | 조용히 재시도. 반복 실패 시에만 사용자 안내. |
| GPS 약함 | 정확도 낮은 포인트 무시 + "Weak GPS" 미니 표시. |
| 권한 거부(위치) | 기능 설명 + 설정 이동 버튼. 주행 불가 사유 명확히. |
| 빈 데이터(Explore/Diary/Wallet) | 항상 의미있는 빈 상태 + 다음 행동 CTA. 콜드스타트엔 시드 콘텐츠. |
| 배터리 부족 | 주행 중 저전력 모드 제안(추적 주기 늘림). |
| 다국어 | 모든 문자열 i18n 키. 길이 변동 대비 레이아웃(일/중/한 폭 차이). |

---

## 9. 재사용 컴포넌트 인벤토리 (Component-Driven)

`RouteCard`, `SpotTimelineItem`, `GlassDashboard`, `SpeedMetric(tabular-nums)`, `PhotoPinFab`, `PhotoPinSheet`, `VoucherCard`, `VoucherWalletItem`, `StampPassportGrid`, `MapView(native/web 어댑터)`, `OfflineBadge`, `SocialBar(like/comment/share)`, `EmptyState`, `PermissionPrimer`, `LanguagePicker`, `PrimaryCTAButton(≥60px)`.

> 모든 색·간격·터치 타깃은 `theme.ts` 토큰 참조(하드코딩 금지). 지도 위 텍스트는 스크림으로 대비 4.5:1 보장.

---

## 10. 감정 곡선 ↔ 화면 매핑 (요약)
| 시나리오 감정 | 화면 | UX 장치 |
|---|---|---|
| 막막함→안심 | 온보딩/로그인 | 1초 로그인, 권한 프라이밍, 격려 카피 |
| 발견의 설렘 | Explore/RouteDetail | Rider Stories 피드, 여정 타임라인 |
| 안심(물류) | Logistics Tips | 공항→출발지 단계 가이드 |
| 몰입(기행문) | Ride/PhotoPin | 자동 사진 마크업, 글래스 대시보드 |
| 긍정적 재해석 | Ride 이탈 | Blue→Pink, 경고 대신 "exploring ✨" |
| 뜻밖의 보상 | VoucherCard/Wallet | 스프링 등장, Wallet로 날아가는 모션 |
| 완성·공유 | Diary/Publish | 타임라인 기행문, "story is live" |
