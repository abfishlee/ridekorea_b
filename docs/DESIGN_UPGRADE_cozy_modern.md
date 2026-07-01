# 🎨 Design Upgrade — Cozy Modern Minimal (living tracker)

출처: `vision_doc/11_cozy_modern_minimal_ux_spec.md` + `vision_doc/img/cozy_modern_ride_ui.png`

**원칙**: 기능 로직은 건드리지 않는다(디자인 토큰 + 화면 폴리시만). 기존 theme 토큰 이름은 유지하고 값만 교체, 신규 토큰은 추가만(제거 0)하여 기존 화면 무파손. 각 단계 독립 커밋 + `npm run typecheck` exit 0 유지.

**제외(기능 대수술 방지, 백로그 유지)**: 다크모드 신규 도입 · 마커 클러스터링 · 네이티브 지도 SDK 교체 · 신규 바텀시트 인터랙션.

상태: ✅ 완료 · ◐ 진행 · ☐ 대기

| 단계 | 내용 | 상태 |
|---|---|---|
| **D1** | theme.ts 기반 고도화(웜 팔레트·여백·라운딩·그림자·글래스 토큰) | ✅ |
| **D2** | Explore 폴리시(오트밀 세그먼트·소프트 그림자 카드·파스텔 태그) | ☐ |
| **D3** | Ride HUD(프로스티드 글래스·딥네이비/코랄 궤적·알약 버튼) | ☐ |
| **D4** | Diary 폴리시(행간 1.6·소프트 그림자·원형 썸네일 핀) | ☐ |
| **D5** | Wallet 폴리시(바우처 첩 소프트 그림자·모던 마감) | ☐ |
| **D6** | 공통(POI/Route 상세: 원형 핀·소프트 그림자·surfaceMuted) | ☐ |

---

## 진행 로그

### D1 — theme.ts 기반 고도화 ✅
- `colors.bg` `#F8FAFC`→`#FDFBF7`(웜 오프화이트), `colors.textMuted` `#475569`→`#64748B`(웜 슬레이트), `colors.exploration` `#EC4899`(네온핑크)→`#E17055`(테라코타 코랄).
- 신규 토큰: `surfaceMuted #F5F2EB`(오트밀), `glassLight`/`glassDark`/`borderGlass`(프로스티드 글래스), `shadows.soft`(확산 그림자, opacity 0.06·radius 16).
- 여백 확대: `space.lg 16→18`, `xl 24→28`, `xxl 32→36`, `touch 60→64`. 라운딩: `radius.sm 8→10`, `card 16→20`.
- 기존 키(accent·warning·scrimDark·scrimLight·textOnGlass*·border·success·danger) 전부 보존 → 컴포넌트 무파손. `shadows`를 theme 객체에 편입.
- 검증: `npm run typecheck` exit 0(전역 자동 반영, 코드 변경 0).
