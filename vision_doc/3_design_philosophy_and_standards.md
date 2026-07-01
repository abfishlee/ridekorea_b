# 3. 디자인 철학 및 표준 (Design Philosophy & Standards)

## 🎨 3대 디자인 철학

1. **The Map is the Hero (지도가 주인공이다)**
   * **Ride 탭**: 화면의 ~90%를 지도가 차지. 주요 정보(속도, 남은 거리, 스팟 핀)는 **Glassmorphism(투명도+블러)** 플로팅 UI로 지도 위에 떠 있는다.
   * **예외**: Explore(피드)·Diary(타임라인)·Wallet은 카드/리스트 중심이므로 지도-우선 규칙을 강제하지 않는다. "지도가 주인공"은 주행 경험의 원칙이지 모든 화면의 규칙이 아니다.
2. **Glanceable & Safe-Stop UX (한눈에, 안전하게)**
   * 주행 중 세밀 조작 불가 가정. 글자는 크고 명확하게. 주요 버튼(사진, 멈춤)은 장갑 착용 상태에서도 누르기 쉽게 **최소 60×60px**(권장 터치 타깃 48dp 이상, 본 앱은 주행 특성상 60px).
3. **Positive Reinforcement (긍정적 강화)**
   * 길을 잃은 것을 실패가 아닌 '새로운 탐험'으로 느끼게 색으로 감정을 조절(아래 컬러 시스템).

---

## 🖌️ 디자인 토큰 (Design Tokens)

`theme.ts`에 토큰으로 정의해 모든 컴포넌트가 하드코딩 없이 참조한다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `color.primary` (K-Indigo) | `#1E3A8A` | 헤더·주요 버튼·기본 마커 |
| `color.accent` (Aero Blue) | `#0EA5E9` | **정상 주행 궤적(planned/track)** |
| `color.exploration` (Adventure Pink) | `#EC4899` | **이탈 개척로(deviated_geom)** |
| `color.warning` (Alert Orange) | `#F59E0B` | 위험구간 경고(빨강 배제) |
| `color.bg` (Cloud White) | `#F8FAFC` | 패널·바텀시트 배경 |
| `color.onGlass` | `#0F172A` / `#FFFFFF` | 글래스 UI 위 텍스트(아래 대비 규칙) |
| `radius.card` | `16` | 카드/바텀시트 |
| `space.touch` | `60` | 주행 버튼 최소 크기 |

### 지도 위 가독성·접근성 (필수)
* 글래스 플로팅 UI 위 텍스트는 지도(회색 도로·녹색 자연·위성)에 묻히지 않도록 **반투명 다크 스크림(scrim)** 위에 흰 텍스트, 또는 흰 스크림 위에 다크 텍스트로 **WCAG 대비 4.5:1 이상**을 보장한다.
* 햇빛 아래 주행 환경을 고려해 속도·거리 등 핵심 수치는 고대비·대형으로.
* 색각 이상 사용자를 위해 Blue/Pink 궤적은 **색 + 패턴(실선/점선)** 이중 부호화를 권장한다.

> ※ 스타일링: 외부 유틸리티 라이브러리(Tailwind/NativeWind) 대신 RN 기본 `StyleSheet` + 위 토큰을 사용한다(성능·번들 최소화).

---

## 🔠 타이포그래피 (다국어 최적화)

글로벌 인바운드 앱의 핵심은 '다국어 렌더링이 깨지지 않는 것'이다. `expo-font`로 앱 로드 시 폰트를 캐싱한다.

* **English(기본)**: `Inter` (숫자 가독성 — 속도계 폰트)
* **Japanese**: `Noto Sans JP`
* **Chinese**: `Noto Sans SC/TC`
* **Korean**: `Pretendard`

운영 팁:
* 속도계 숫자 떨림(Jitter) 방지: `fontVariant: ['tabular-nums']` 필수.
* 폰트 미로딩 시 레이아웃 깨짐 방지: 폰트 로드 완료 전 스플래시 유지(`expo-splash-screen`).
* 텍스트는 코드에 하드코딩하지 말고 **i18n 키**(`en/ja/zh/ko`)로 분리(`i18next` 등) — 다국어 확장을 위해 처음부터 적용.
