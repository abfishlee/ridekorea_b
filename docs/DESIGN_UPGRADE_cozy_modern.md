# 🎨 Design Upgrade — Cozy Modern Minimal (living tracker)

출처: `vision_doc/11_cozy_modern_minimal_ux_spec.md` + `vision_doc/img/cozy_modern_ride_ui.png`

**원칙**: 기능 로직은 건드리지 않는다(디자인 토큰 + 화면 폴리시만). 기존 theme 토큰 이름은 유지하고 값만 교체, 신규 토큰은 추가만(제거 0)하여 기존 화면 무파손. 각 단계 독립 커밋 + `npm run typecheck` exit 0 유지.

**제외(기능 대수술 방지, 백로그 유지)**: 다크모드 신규 도입 · 마커 클러스터링 · 네이티브 지도 SDK 교체 · 신규 바텀시트 인터랙션 · 지도 원형 사진-썸네일 핀(route_spots_geojson에 photo_url 배관 필요 = 기능성).

상태: ✅ 완료 · ◐ 진행 · ☐ 대기

| 단계 | 내용 | 상태 | 커밋 |
|---|---|---|---|
| **D1** | theme.ts 기반 고도화(웜 팔레트·여백·라운딩·그림자·글래스 토큰) | ✅ | `754297d` |
| **D2** | Explore 폴리시(오트밀 세그먼트·소프트 그림자 카드·author i18n) | ✅ | `b8d0deb` |
| **D3** | Ride HUD(프로스티드 글래스·딥네이비/코랄 궤적·알약 버튼) | ✅ | `39bac9b` |
| **D4** | Diary 폴리시(소프트 그림자 카드·오트밀 썸네일·여백) | ✅ | `39bac9b`+ |
| **D5** | Wallet 폴리시(공용 소프트 그림자·라운드 티켓 스텁) | ✅ | (D4와 함께) |
| **D6** | 공통(logistics·Route·POI 상세: 소프트 그림자·오트밀 패널·행간) | ✅ | (본 커밋) |

**전 단계 `npm run typecheck` exit 0 유지. 기능 로직 변경 0.**

---

## 진행 로그

### D1 — theme.ts 기반 고도화 ✅ (`754297d`)
- `bg` `#F8FAFC`→`#FDFBF7`(웜 오프화이트), `textMuted` `#475569`→`#64748B`(웜 슬레이트), `exploration` `#EC4899`(네온핑크)→`#E17055`(테라코타 코랄).
- 신규 토큰: `surfaceMuted #F5F2EB`(오트밀), `glassLight`/`glassDark`/`borderGlass`, `shadows.soft`(opacity 0.06·radius 16).
- 여백: `lg 16→18`·`xl 24→28`·`xxl 32→36`·`touch 60→64`. 라운딩: `sm 8→10`·`card 16→20`. 기존 키 전부 보존 → 무파손.

### D2 — Explore 폴리시 ✅ (`b8d0deb`)
- `RouteCard`: `shadows.soft` 적용, 커버 플레이스홀더 `surfaceMuted`, overflow 제거+커버 상단 라운딩으로 그림자 보존. author 폴백 `"Rider"`/`"Official route"` → 기존 i18n 키(`route.rider`/`route.official`)로 이관(8.1 스캔이 표현식이라 놓친 부분).
- `index.tsx` 세그먼트: 오트밀 트랙 + 흰색 활성 필(소프트 그림자), 활성 텍스트 K-Indigo.

### D3 — Ride HUD ✅ (`39bac9b`)
- `GlassDashboard`: 다크 스크림 → 웜 프로스티드 글래스(`glassLight`+`borderGlass`+`shadows.soft`), 텍스트 다크로 전환, 상태 필/텍스트 색을 온루트=primary·이탈=coral로. (백드롭 블러 의존성 추가 없이 반투명 근사)
- `naverMap.ts`: 온루트 궤적 `#0EA5E9`→`#1E3A8A`(딥네이비), 이탈 `#EC4899`→`#E17055`(코랄), 계획 점선 `#94A3B8`→`#C4BBAA`(웜그레이), 로딩 캔버스 `#E2E8F0`→`#EFEAE0`(웜샌드). 변수명/로직 무변경.
- `ride.tsx`: 인트로 패널 웜 글래스+다크 텍스트, 버튼(`touch:64` pill K-Indigo는 D1로 이미 반영)에 소프트 그림자, ghost/photo 버튼 `borderGlass`.

### D4 — Diary 폴리시 ✅ (`39bac9b`+)
- 여정 카드: `shadows.soft`, 썸네일 `surfaceMuted`+좌측 라운딩(overflow 제거로 그림자 보존), 카드 간격 `md→lg`.

### D5 — Wallet 폴리시 ✅ (D4와 함께 push)
- `VoucherCard`: 하드코딩 그림자 → 공용 `shadows.soft`, 티켓 스텁 좌측 라운딩(overflow 제거), 카드 간격 `md→lg`.

### D6 — 공통(상세/보드) ✅ (본 커밋)
- `logistics.tsx`: 팁 카드 `shadows.soft`, 카테고리 뱃지 `surfaceMuted`, 본문 행간 21→22.
- `route/[id].tsx`: 스탯 카드 `shadows.soft`, 커버/스팟사진/댓글아바타 플레이스홀더 `surfaceMuted`. (요약 행간은 이미 22)
- `poi/[id].tsx`: 카드(물류/신고 컨테이너) `shadows.soft`, 신고 입력창 `surfaceMuted`.
