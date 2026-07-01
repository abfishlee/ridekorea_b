# 🧭 RideKorea_b — AI 인수인계(Handoff) 문서

> **이 문서 하나만 읽으면 다른 AI(또는 다른 PC의 나)가 프로젝트를 이해하고 곧바로 이어서 작업할 수 있도록** 정리한 핸드오프 노트입니다.
> 최종 업데이트: 2026-07-01 · 상태: 로컬 개발 환경 구동 확인, 전체 진행률 **≈82%**

---

## 0. 30초 요약 (TL;DR)

- **무엇**: 한국을 여행하는 **외국인 자전거 여행자**를 위한 인바운드 사이클링 투어 앱 (공익적 성격, 개인 프로젝트).
- **핵심 컨셉(사사키 시나리오)**: 남이 만든 루트를 "내 루트로 가져와" 라이딩하고, **경로를 벗어나면(이탈) 파란 선이 분홍 선("나만의 길")으로** 바뀌며 자기만의 여행기가 된다. 지역 진입 시 **바우처**, 인증센터에서 **스탬프**, 사진 **핀**으로 여정을 기록.
- **스택**: Expo SDK 56 / React Native 0.85 / expo-router / **Supabase(로컬, Docker)** / zustand / TanStack Query / i18next(ko·en·ja·zh) / 지도는 **네이버 지도 WebView**(비용 최소화).
- **지금 상태**: 백엔드(RPC·RLS) 대부분 완성 + 로컬 DB 검증 완료. 프론트 Explore/Detail/Ride 완성, **Phase 5·6 화면 완성(100%)** — Wallet(바우처·리덴), Diary(내 여정·발행), 루트 상세 댓글까지 동작.
- **다음 할 일**: ① 웹 미리보기(브라우저에서 전 화면 시각 확인) + `RideMap.web` 실지도화. 이후 7.2 물류 가이드 / 8.1 다국어 완성. (§7 참고)
- **작업 원칙**: **한 번에 하나씩**, 매 작업 후 `npm run typecheck`(exit 0 유지) + 로컬 Supabase로 검증. 상세 규칙은 §6.

> ⚠️ **개인 프로젝트**입니다. 팀 Obsidian vault(work-history-hub)나 팀 GitLab에 **기록하지 않습니다.** 이 저장소(GitHub `abfishlee/ridekorea_b`) 안에서만 문서화합니다.

---

## 1. 프로젝트 진실의 원천(Source of Truth)

`vision_doc/` 폴더가 기획·설계의 원본입니다. 깊게 파려면 여기부터:

| 파일 | 내용 |
|---|---|
| `vision_doc/0_sasaki_scenario.md` | **핵심 사용자 시나리오**(사사키). 제품 감을 잡는 가장 빠른 길 |
| `vision_doc/1_development_goals_and_guidelines.md` | 개발 목표·가이드라인 |
| `vision_doc/2_tech_stack_and_db_models.md` | 기술 스택·DB 모델 |
| `vision_doc/3_design_philosophy_and_standards.md` | 디자인 토큰·표준 (→ `src/theme/theme.ts`와 일치) |
| `vision_doc/4_service_architecture_and_menus.md` | 서비스 구조·메뉴 |
| `vision_doc/5_database_schema_sql.md` | DB 스키마 |
| `vision_doc/6_core_flows_and_algorithms.md` | 핵심 플로우·알고리즘(이탈 감지 등) |
| `vision_doc/7_mvp_scope_and_roadmap.md` | MVP 범위·로드맵 |
| `vision_doc/8_naver_map_cost_strategy.md` | **네이버 지도 비용 전략(중요)** |
| `vision_doc/9_ui_ux_spec.md` | UI/UX 사양 |
| **`vision_doc/10_development_phases.md`** | **🟢 살아있는 진행 트래커. 매 작업 후 갱신. 현재 위치는 항상 여기서 확인** |

**작업을 이어받을 때: `vision_doc/10_development_phases.md`를 먼저 열어 "🎯 현재 포커스"와 진행률 표를 확인하세요.**

---

## 2. 기술 스택 & 아키텍처

**프론트엔드**
- Expo SDK **56**, React Native **0.85.3**, React **19**, TypeScript
- 라우팅: **expo-router**(파일 기반, `app/`), typedRoutes 활성
- 상태: **zustand**(`src/stores/`) + **@tanstack/react-query**(서버 상태/캐시)
- i18n: **i18next / react-i18next**, 4개 언어(ko/en/ja/zh), `src/i18n/`
- 지도: **네이버 지도 Web Dynamic Map을 WebView로** 로드(`react-native-webview`). 네이티브 SDK 미사용(비용·단순화). §5 비용 원칙 참고.
- 로컬 저장: **expo-sqlite**(라이딩 아웃박스 = 오프라인/크래시 안전), **AsyncStorage**(세션)
- 위치: **expo-location**, 사진: **expo-image-picker**

**백엔드 (Supabase, 로컬 Docker)**
- Postgres + PostgREST(REST) + GoTrue(Auth) + Storage + Kong(gateway)
- 비즈니스 로직은 **RPC 함수(SECURITY DEFINER) + RLS**로 구현(엣지 함수 최소화)
- 마이그레이션: `supabase/migrations/*.sql`, 시드: `supabase/seed.sql`
- 타입 생성: `npm run gen:types` → `src/types/database.ts`

**폴더 구조 (핵심)**
```
app/                      # expo-router 화면
  _layout.tsx, login.tsx
  (tabs)/ index(=Explore) · ride · diary · wallet · _layout
  route/[id].tsx          # 루트 상세
src/
  features/
    explore/  route/  ride/  geofence/  wallet/  stamps/
  stores/     # zustand (ride.ts 등)
  lib/        # naverMap.ts (지도 HTML 빌더) 등
  theme/      # theme.ts (디자인 토큰 — 색/여백/폰트)
  i18n/       # locales/*
  types/      # database.ts (Supabase 생성 타입)
  components/
supabase/     # config.toml · migrations/ · seed.sql
vision_doc/   # 기획·설계 원본 + 진행 트래커(10_*)
docs/         # (이 문서)
```

**주요 DB 객체 / RPC (전부 로컬 검증 완료)**
- 루트: `import_route`, `toggle_like`, `route_path_geojson`, `route_spots_geojson`, `publish_route`, `add_comment`
- 라이딩: `finalize_ride`, `add_ride_spot`(사진 핀, Storage `ride-photos` 버킷)
- 지오펜스/바우처: `nearby_regions_geojson`, `claim_voucher`, `redeem_voucher`
- 스탬프: `certification_centers_geojson`, `award_stamp`

---

## 3. 로컬 세팅 (집 PC에서 이어받기)

> 전제: Node.js(LTS), Git, **Docker Desktop**. Android 실기기 테스트를 원하면 Expo 계정 + EAS.

```bash
# 1) 클론
git clone https://github.com/abfishlee/ridekorea_b.git
cd ridekorea_b

# 2) 의존성
npm install

# 3) 환경변수
copy .env.example .env      # (mac/linux: cp)
#   .env 편집:
#   - EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   - EXPO_PUBLIC_SUPABASE_ANON_KEY  ← 아래 supabase start 후 `npx supabase status`의 anon key
#   - EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ← 본인 NCP Maps 키(지도 볼 때만 필요, 없으면 지도 자리에 안내 표시)

# 4) 로컬 Supabase (Docker 필요)
npx supabase start          # 최초엔 이미지 pull(수 GB). 완료 후 URL/키 출력
#   → 출력된 anon(publishable) key를 .env에 반영

# 5) DB 준비(스키마+시드). 볼륨이 비어있거나 초기화하려면:
npx supabase db reset       # 마이그레이션 전체 + seed.sql 적용

# 6) 실행
npm run web                 # 웹 미리보기 (http://localhost:8081) — 지도는 플레이스홀더(과금 없음)
#   또는 실기기: EAS dev client 빌드 후 `npx expo start --dev-client` (§ eas.json 프로파일 development)

# 품질 게이트(반드시 통과 유지)
npm run typecheck           # exit 0 유지가 규칙
```

**로그인**: 로그인 화면 → **Dev sign-in**(구글 스킵). 그러면 탭(Explore/Ride/Diary/Wallet) 진입.

**시드 데이터 참고(로컬 검증용 상수)**
- seed user(Peter) uuid: `11111111-1111-1111-1111-111111111111`
- 공식 서울→부산 루트: `00000000-0000-0000-0000-0000000000a1`
- Peter 여행기 루트(PUBLIC/FINISHED): `...0000b1`
- 부여군 region: `...0000c1` (내부 좌표 126.925,36.27)
- 금강하구둑 인증센터: `dbf8a826-dfb8-461e-8144-c43ee32f0119` (126.7415,36.0007)
- DB 컨테이너: `supabase_db_RideKorea_b`

---

## 4. ⚠️ 환경 관련 필수 주의사항 (하드-원 러닝)

이 프로젝트를 Windows에서 **AI 에이전트로 자동화**할 때 실제로 겪은 문제들. (일반 개발자가 손으로 하면 대부분 무관하지만, AI가 이어서 자동화한다면 반드시 숙지.)

1. **Docker Desktop은 "시작 메뉴에서 사용자가 직접" 켠다.**
   - AI 에이전트(패키지 앱 샌드박스) 컨텍스트에서 `Start-Process`로 Docker를 켜면 `com.docker.backend`가 **`ProgramData` 환경변수를 못 찾아 12~19GB까지 폭주**하고 데몬이 안 뜬다. → 메모리 full → 시스템 멈춤.
   - 사용자가 시작 메뉴에서 켜면 정상 환경(ProgramData 존재)으로 뜬다. **데몬이 뜬 뒤에는** AI가 `docker`/`supabase` CLI로 이어받으면 됨(named pipe라 샌드박스 무관).
2. **누적 컨테이너 자동시작 주의.** 여러 프로젝트(ridekorea, RideKorea_b, 농림부AX=ph-*, adms) 컨테이너가 쌓이면 Docker 켤 때 한꺼번에 복원돼 메모리 폭주. 대응: 안 쓰는 컨테이너는 `restart=no`로(현재 적용됨) 두고, 필요할 때만 `supabase start`/`docker start`.
3. **Supabase 스택은 트림해서 가볍게.** `supabase/config.toml`에서 Studio·Realtime·메일(inbucket)·Edge Runtime·Vector를 **비활성화**해 둠(db·kong·auth·rest·storage 5개만 뜸). 이 앱은 이것들 불필요. Edge 함수 테스트가 필요하면 `[edge_runtime] enabled` 다시 켜기.
4. **`supabase start` 첫 시도에서 storage가 unhealthy로 롤백**되면 그냥 **한 번 더 실행**하면 됨(DB 데워지면 통과, 타이밍 이슈).
5. **파일 인코딩(Windows).** PowerShell `>` 리다이렉트는 UTF-16을 만들어 한글이 깨진다. 파일 쓰기는 **UTF-8(BOM 없음)** 로: 에디터/`WriteAllText(path, text, UTF8Encoding($false))` 사용. `.wslconfig`도 UTF-8 no-BOM이어야 WSL이 읽는다.
6. **깨진 소켓.** Docker를 강제종료하면 `dockerInference`/`docker-secrets-engine\engine.sock` 등 unix 소켓이 깨진 채 남아 다음 실행이 크래시할 수 있다. Windows에선 못 지우고, WSL(drvfs 마운트)에서 `rm` 해야 지워진다.

---

## 5. 💸 비용 & 안전 원칙 (네이버 지도)

- 네이버 지도는 **로드/호출당 과금**. 그래서:
  - 지도는 **WebView로 1회 로드** 후, 라이딩 중 위치·트랙은 `injectJavaScript`로 **증분 갱신(재로드 없음)** → `src/lib/naverMap.ts`의 `buildRideMapHtml`.
  - 웹 미리보기의 Ride 지도는 **플레이스홀더**(과금 0). 실지도는 앱/Dev Client에서.
  - 유료 서비스 연동 전, 순수 TypeScript 로직 모듈부터 검증(합성 데이터 테스트).
- 지도 키가 없으면(`EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` 미설정) 지도 자리에 안내가 뜨고, **추적/대시보드는 정상 동작**.

---

## 6. 작업 방식 & 규칙 (AI가 지킬 것)

1. **한 번에 하나씩.** 한 작업(파일/기능) 끝내면 → `npm run typecheck`(exit 0) → 가능하면 로컬 Supabase로 검증 → 완료 보고 + `vision_doc/10_development_phases.md` 갱신 → 다음 단계 제안. 사용자가 "계속/진행"하면 진행.
2. **타입체크 그린 유지**가 절대 규칙(`tsc --noEmit`).
3. **DB 검증 패턴**: 임시 `.sql`을 `docker exec -i supabase_db_RideKorea_b psql -U postgres -d postgres`로 파이프. 변경은 `BEGIN; … ROLLBACK;`로 감싸 시드 보존. 인증 컨텍스트는 `SET request.jwt.claims TO '{"sub":"<uuid>","role":"authenticated"}';`.
4. **단일 파일 TS 로직 테스트**: `npx tsc <file> --outDir _t --rootDir <dir> --target es2019 --module commonjs --skipLibCheck --ignoreConfig` 후 `node _t_*.cjs` 실행, 끝나면 정리.
5. **마이그레이션/타입**: 스키마 바꾸면 `supabase/migrations/`에 추가 → `npx supabase migration up` → `npm run gen:types`.
6. **개인 프로젝트**: 팀 vault/GitLab 기록 금지. 문서는 이 저장소 안에서만.
7. **커밋**: 의미 있는 단위로. 비밀번호·토큰은 커밋/문서에 평문으로 넣지 않음(`.env`는 `.gitignore`됨).

---

## 7. 현재 진행 상황 & 다음 할 일

**전체 ≈82% (27/33 작업).** 정확한 최신 상태는 항상 `vision_doc/10_development_phases.md` 참조.

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 기획·설계 문서 | ✅ 100% |
| 1 | DB & 백엔드 코어 | ◐ 90% (잔여: 1.4 Edge Function 통합테스트) |
| 2 | 앱 스켈레톤 | ✅ 100% |
| 3 | Explore & Route Detail | ✅ 100% |
| **4** | **Ride 코어(추적·이탈·사진핀)** | **✅ 100%** |
| 5 | 지오펜싱 & 바우처 | ✅ 100% |
| 6 | Diary & 소셜 | ✅ 100% |
| 7 | 스탬프·물류·ETL | ◐ 33% |
| 8 | 하드닝 & 출시 준비 | ◐ 25% |

**방금 완료 (Phase 5·6 화면 완성)**
- **Wallet(5.2/5.3)** — `src/features/wallet/VoucherCard.tsx`(티켓형, RN Animated.spring 등장) + `app/(tabs)/wallet.tsx`(내 바우처 리스트·리덴·빈 상태·새로고침).
- **Diary(6.1)** — `src/features/diary/api.ts`(`useMyJourneys`) + `app/(tabs)/diary.tsx`(내 여정 카드·상태/공개 배지·Ride 직행·**FINISHED 발행 토글**). 가져온 루트 재-import 없이 여는 진입점.
- **댓글 UI(6.3)** — `app/route/[id].tsx` 댓글 섹션(목록·입력/전송·내 댓글 삭제, 국기 아바타).
- **특정 루트 라이딩 플로우** — 루트 상세 `[Ride this route]`(소유 루트)/`[Make it my route]`→`[Ride now]` → Ride 화면이 `?routeId=`로 계획 경로(`route_path_geojson`)를 받아 지도 표시 + **이탈 감지(파랑→분홍)** + 종료 시 `finalizeAndClear`→`finalize_ride` 서버 저장.
- `app/(tabs)/ride.tsx` — 자유 라이딩 시작/일시정지/종료 + 복구 프롬프트 + **루트 라이딩 모드**(파라미터 기반)
- `src/features/ride/GlassDashboard.tsx` — 속도·거리·시간 + 정상(파랑)/이탈(분홍) 배지
- `src/features/ride/RideMap.tsx`(네이티브 WebView 라이브 지도) / `RideMap.web.tsx`(웹 폴백)
- `src/lib/naverMap.ts` `buildRideMapHtml` — 1회 로드 후 증분 갱신(과금 안전)
- `src/features/ride/photos.ts` + `expo-image-picker` — 카메라 → 사진 핀 큐잉 → 종료 시 동기화
- `eas.json`(android dev client), `app.json`에 image-picker 권한 플러그인
- 이탈 감지기: 계획 경로 없으면(자유 라이딩) 이탈로 안 잡히도록 가드
- 스토어 getter 추가(`getTrackCoords/getDeviatedSegments/getPosition`), 아웃박스 웹 비치명적 처리

**➡️ 다음 (우선순위)**
1. **① 웹 미리보기 + 실지도화** — 브라우저에서 Explore·Ride·Wallet·Diary·상세를 시각 확인(오랫동안 미확인), `RideMap.web.tsx`에 인라인 웹 네이버 지도 + 브라우저 geolocation 추적. *(Docker→`supabase start`→`npm run web` 필요)*
2. **7.2 물류 가이드(logistics_tips)** — 인천공항 자전거 수하물 등 가이드 보드.
3. **8.1 다국어 완성(EN/JP/ZH/KO)** — 신규 화면(Wallet/Diary/댓글) 문자열을 i18n으로 이관.
4. **8.2 모더레이션(reports) + 8.4 EAS 빌드**, 잔여 1.4 Edge Function 통합테스트.

**백로그(나중 폴리시)**
- 스팟 마커: 사진 있으면 **원형 사진 마커**, 없으면 이모지 (`route_spots_geojson`에 photo_url 추가)
- 마커 **밀집 구간 클러스터링**
- Ride 지도 **네이티브 Naver SDK 교체**(성능 최적화). 현재 WebView로 충분.
- `claim_voucher`가 현재 **지역당 첫 바우처만 발급**(`order by created_at limit 1`) → 다중 바우처 발급 필요 시 재설계.

---

## 8. 이어받는 AI를 위한 체크리스트

1. `vision_doc/0_sasaki_scenario.md`로 제품 감 잡기 → `vision_doc/10_development_phases.md`로 현재 위치 확인.
2. §3대로 로컬 세팅(Docker→`supabase start`→`.env`→`npm run web`), **`npm run typecheck` 그린** 확인.
3. §4·§5·§6 규칙 숙지(특히 Docker/ProgramData, 비용, 한 번에 하나씩).
4. §7의 "다음" 1번(웹 Ride 실지도) 또는 2번(특정 루트 라이딩)부터 진행.
5. 작업 후 트래커(`10_*`) 갱신 + 커밋.

> 질문/모호하면: 추측하지 말고 `vision_doc/`의 해당 문서를 근거로 판단하고, 없으면 사용자에게 확인.
