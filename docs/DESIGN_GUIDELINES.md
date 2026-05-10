# KL Project — 디자인 가이드라인 v3.0
**Quiet Luxury Edition · Admin Dashboard 통일 디자인 시스템**

> **북극성:** 화려함이 아닌 **정확함**으로 럭셔리를 전달한다.
> Linear의 정밀함 + The Row의 절제 + 블랙·골드의 KTV 프리미엄.
> "디자인이 보이지 않을 때 디자인이 가장 잘 된 것이다."

---

## 0. 디자인 원칙 (Design Principles)

이 5가지 원칙이 모든 결정의 기준입니다. **충돌 시 위에서 아래 순서로 우선합니다.**

| # | 원칙 | 의미 |
|---|---|---|
| 1 | **Restraint over Decoration** | 장식보다 절제. 효과 추가 전에 "이게 정말 필요한가?" 자문. |
| 2 | **Hierarchy by Typography & Spacing** | 색상으로 위계 만들지 않음. weight, size, spacing으로만. |
| 3 | **One Accent, Used Rarely** | 골드는 액션·포커스·핵심 데이터에만. 남용하면 럭셔리가 사라짐. |
| 4 | **Density with Breath** | 정보는 조밀하게, 그러나 그룹 간엔 충분한 여백. |
| 5 | **Motion Serves Function** | 애니메이션은 상태 변화·피드백만. 장식용 모션 금지. |

---

## 1. 브랜드 아이덴티티

| 항목 | 값 |
|---|---|
| **서비스명** | KL Entertainment Management |
| **로고 표기** | 사이드바 상단 — `KL` (텍스트만, 배지 제거), 서브 `GROUP · MANAGEMENT` |
| **컨셉** | Quiet Luxury KTV Management — 검정 캔버스 위 골드 한 점 |
| **톤** | 절제 · 정밀 · 신뢰 · 고요한 고급감 |

> ⚠️ **변경:** 기존 "gradient 배지 + text-glow" 로고 → **순수 타입 로고**. 골드는 `KL` 두 글자에만 적용, 글로우 효과 제거.

---

## 2. 색상 시스템 (Color Tokens)

### 2.1 핵심 원칙
- **Gold 1색 + Neutral 9단계 그레이 + Status 4색** = **총 14개 토큰**으로 전체 시스템 운영
- 카테고리별 사이드바 색상 (보라/파랑/에메랄드/앰버) **전면 제거** → 단일 골드 액센트로 통일
- 그라데이션 **전면 금지** (단, 다이얼로그 백드롭 외)

### 2.2 토큰 정의

```css
:root {
  /* === Surface (배경 위계) === */
  --surface-base:      hsl(240 18% 5%);   /* #0A0A0D — 최하단 */
  --surface-1:         hsl(240 16% 8%);   /* #111114 — 사이드바, 헤더 */
  --surface-2:         hsl(240 14% 11%);  /* #18181C — 카드 */
  --surface-3:         hsl(240 12% 14%);  /* #1F1F23 — Hover, Input */
  --surface-overlay:   hsl(240 18% 5% / 0.85); /* 다이얼로그 백드롭 */

  /* === Border (보더 위계) === */
  --border-subtle:     hsl(0 0% 100% / 0.06);  /* 카드, 패널 */
  --border-default:    hsl(0 0% 100% / 0.10);  /* 인풋, 버튼 outline */
  --border-strong:     hsl(0 0% 100% / 0.16);  /* Hover, 강조 */

  /* === Text (텍스트 위계) === */
  --text-primary:      hsl(0 0% 98%);      /* 본문, 헤딩 */
  --text-secondary:    hsl(240 6% 70%);    /* 서브 텍스트 */
  --text-tertiary:     hsl(240 5% 50%);    /* 캡션, 메타 */
  --text-disabled:     hsl(240 4% 35%);    /* 비활성 */

  /* === Accent (단일 골드) === */
  --gold:              hsl(43 55% 58%);    /* #C9A961 — 메인 골드 (기존보다 -10% 채도) */
  --gold-hover:        hsl(43 60% 64%);    /* Hover 시 살짝 밝게 */
  --gold-muted:        hsl(43 30% 58% / 0.12); /* Tinted 배경 */
  --gold-foreground:   hsl(240 18% 5%);    /* 골드 위 텍스트 */

  /* === Status (4단계만) === */
  --status-success:    hsl(142 50% 55%);   /* 성공, 활성, 입금 완료 */
  --status-warning:    hsl(38 75% 60%);    /* 경고, 대기, 부분결제 */
  --status-danger:     hsl(0 70% 60%);     /* 오류, 취소, 노쇼 */
  --status-info:       hsl(210 60% 65%);   /* 정보, 진행중 */
}
```

### 2.3 색상 사용 규칙 (Hard Rules)

```
✅ 골드는 다음 4가지에만 사용:
   1. Primary 액션 버튼 (페이지당 1~2개)
   2. 포커스 링 (focus-visible)
   3. 활성 네비게이션 표시 (활성 라인 또는 텍스트)
   4. 핵심 KPI 숫자 강조 (대시보드 상단 메인 메트릭)

❌ 골드 금지:
   - 모든 헤딩 (h1~h6 모두 white)
   - 일반 링크 (white + underline)
   - 차트의 모든 시리즈 (1차 시리즈만 골드, 나머지는 그레이 명도차)
   - 보더 (다크 시스템에선 골드 보더 = 카지노 느낌)

❌ 카테고리별 색상 금지:
   - Personal/Dashboards/Operations 등 카테고리별 색상 모두 제거
   - 카테고리 구분은 "여백 + 라벨"로만 (12. 사이드바 참고)
```

### 2.4 차트 색상 (Sequential Mono)

```
chart-1: var(--gold)              — 메인 시리즈
chart-2: hsl(0 0% 75%)            — 두 번째
chart-3: hsl(0 0% 55%)            — 세 번째
chart-4: hsl(0 0% 38%)            — 네 번째
chart-5: hsl(43 30% 38%)          — 다섯 번째 (어두운 골드, 비교용)
```
> 명도차로 시리즈 구분. 색조 차이는 **status 표시할 때만** 사용.

---

## 3. 타이포그래피 (Typography System)

### 3.1 폰트
| 역할 | 폰트 | 용도 |
|---|---|---|
| **Display** | `Playfair Display` (500/600) | **딱 3곳만**: 로고, 페이지 타이틀(h1), 빈 상태 일러스트 메시지 |
| **Sans (Body)** | `Inter` (400/500/600/700) | 그 외 **모든 텍스트** — h2~h6, 본문, UI |
| **Mono (Numeric)** | `JetBrains Mono` (400/500) | 금액, 시간, ID, 코드 — `tabular-nums` 자동 |

> **변경 핵심:** 기존엔 모든 헤딩에 Playfair 적용 → **h1만 Playfair, h2~h6은 Inter** (Linear, Stripe 방식). Playfair 남용 시 카지노 메뉴판 느낌이 남.

### 3.2 타입 스케일 (Type Scale)

```
Display    text-4xl   font-display  font-medium    tracking-tight   → 페이지 타이틀(h1)만
H2         text-2xl   font-sans     font-semibold  tracking-tight   → 섹션 타이틀
H3         text-lg    font-sans     font-semibold  tracking-normal  → 카드 타이틀
H4         text-base  font-sans     font-semibold  tracking-normal  → 서브섹션
Body       text-sm    font-sans     font-normal    leading-6        → 기본 본문
Body-sm    text-xs    font-sans     font-normal    leading-5        → 메타, 캡션
Label      text-xs    font-sans     font-medium    tracking-wide    uppercase → 폼 라벨, 카테고리
Numeric    font-mono  tabular-nums                                  → 숫자 (테이블, KPI)
```

### 3.3 헤딩 사용 규칙

```html
<!-- ✅ Good -->
<h1 class="font-display text-4xl font-medium tracking-tight">Operations</h1>
<h2 class="text-2xl font-semibold tracking-tight">Today's Sessions</h2>
<h3 class="text-lg font-semibold">Room VIP-3</h3>

<!-- ❌ Bad: Playfair on h2/h3 -->
<h2 class="font-display ...">  <!-- 금지 -->
```

### 3.4 효과 제거
- ❌ **`text-glow` 제거** — 골드 발광 효과는 럭셔리가 아닌 카지노 느낌
- ❌ **`text-shadow` 일체 사용 금지**
- ✅ 위계는 오직 **font-weight + color + size**로만

---

## 4. 간격 시스템 (Spacing Scale)

**4pt 그리드 시스템.** 자유 픽셀값 사용 금지.

```
0  1  2  3  4  6  8  12  16  24  32  48  64  96
   4  8  12 16 24 32 48  64  96  128 192 256 384  (px)
```

Tailwind 클래스 매핑: `p-1=4px, p-2=8px, p-4=16px, p-6=24px, p-8=32px, p-12=48px`

### 사용 규칙
| 컨텍스트 | 값 |
|---|---|
| 인라인 텍스트 간 (badge, icon) | `gap-2` (8px) |
| 폼 필드 간 | `gap-4` (16px) |
| 카드 내부 패딩 | `p-6` (24px) — 모바일 `p-4` |
| 섹션 간 | `gap-8` (32px) |
| 페이지 여백 (메인) | `p-6 md:p-8` |
| 페이지 섹션 간 | `space-y-8` (32px) |

---

## 5. 보더 & 그림자 (Border & Elevation)

### 5.1 보더 (주력)
```
border-subtle  (white/6%)   → 카드, 패널 — 기본
border-default (white/10%)  → 인풋, 분리선 — 명확한 구분
border-strong  (white/16%)  → Hover, 활성 — 강조
```

### 5.2 그림자 (보조 — 거의 사용 안 함)
```css
/* 90%의 경우 보더만 사용. 그림자는 floating UI에만. */
--shadow-popover: 0 8px 24px hsl(0 0% 0% / 0.4);  /* Dropdown, Popover */
--shadow-dialog:  0 16px 48px hsl(0 0% 0% / 0.5); /* Dialog */
```

> ❌ **`shadow-2xl` 카드 효과 제거.** 다크 테마에선 그림자보다 보더가 명확함.

### 5.3 라운드 (Border Radius)
```
rounded-md  (6px)   → 인풋, 버튼, 작은 요소
rounded-lg  (8px)   → 카드, 패널 — 표준
rounded-xl  (12px)  → 다이얼로그, 큰 모달
rounded-full        → 아바타, 뱃지(pill 형태), 토글
```
> 변경: 카드 `rounded-xl` → `rounded-lg` (12px → 8px). 더 정밀해 보임.

---

## 6. 효과 (Effects)

### 6.1 ❌ 제거되는 효과
| 효과 | 사유 |
|---|---|
| `glass-panel` 사이드바/카드 적용 | 다이얼로그/팝오버에만 잔존. 일반 패널엔 솔리드. |
| `text-glow` (골드 발광) | 럭셔리가 아닌 네온 느낌. 전면 제거. |
| Radial Gradient 배경 | 솔리드 `#0A0A0D`로 대체. |
| Gradient 로고 배지 | 솔리드 골드 또는 텍스트만. |

### 6.2 ✅ 유지되는 효과
```css
/* 다이얼로그 / 팝오버 백드롭에만 */
.backdrop-blur-overlay {
  backdrop-filter: blur(8px);
  background: var(--surface-overlay);
}

/* 커스텀 스크롤바 */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: hsl(0 0% 100% / 0.08);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: hsl(0 0% 100% / 0.16);
}
```

### 6.3 Selection
```css
::selection { background: var(--gold-muted); color: var(--text-primary); }
```

---

## 7. 컴포넌트 시스템 (Components)

### 7.1 Button — 4 Variants Only

```
┌──────────────┬─────────────────────────────────────────────────────────┐
│ primary      │ bg-gold text-gold-foreground hover:bg-gold-hover        │
│              │ → 페이지당 1~2개. 핵심 액션만.                          │
├──────────────┼─────────────────────────────────────────────────────────┤
│ secondary    │ border border-default bg-transparent text-primary       │
│              │ hover:bg-surface-3 hover:border-strong                  │
│              │ → 보조 액션. 페이지당 무제한.                           │
├──────────────┼─────────────────────────────────────────────────────────┤
│ ghost        │ bg-transparent text-secondary hover:bg-surface-3        │
│              │ → 취소, 닫기, 인라인 액션.                              │
├──────────────┼─────────────────────────────────────────────────────────┤
│ destructive  │ bg-status-danger/10 text-status-danger                  │
│              │ border border-status-danger/30 hover:bg-status-danger/15│
│              │ → 삭제, 환불, 노쇼 처리. 솔리드 빨강 X.                 │
└──────────────┴─────────────────────────────────────────────────────────┘
```

> 변경: 기존 6 variants → **4 variants**. `outline`은 `secondary`로 통합, `link`는 텍스트 링크로 처리.

#### 사이즈
```
sm:      h-8  px-3 text-xs  → 테이블 인라인 액션
default: h-9  px-4 text-sm  → 폼, 일반
lg:      h-11 px-6 text-sm  → 모달 푸터, 강조 액션
icon:    h-9  w-9           → 아이콘 단독
```

#### 사용 위계 (Hierarchy)
페이지/모달당 버튼 위계:
- **Primary 1개** (제출, 저장, 확인) — 골드
- **Secondary 0~3개** (보조 액션) — 아웃라인
- **Ghost N개** (취소, 닫기) — 투명
- **Destructive 0~1개** (위험 액션) — 빨강 톤

### 7.2 Card

```html
<div class="rounded-lg border border-subtle bg-surface-2 p-6">
  <header class="mb-4 flex items-center justify-between">
    <h3 class="text-lg font-semibold">Today Revenue</h3>
    <button class="ghost-button">⋯</button>
  </header>
  <div class="font-mono tabular-nums text-3xl">RM 12,480</div>
  <p class="mt-1 text-xs text-tertiary">+12.4% vs yesterday</p>
</div>
```

> 변경: `bg-card/80 backdrop-blur-xl` → `bg-surface-2` (솔리드). 백드롭블러는 다이얼로그에만.

### 7.3 Input / Form

```css
.input {
  height: 36px;             /* h-9 */
  padding: 0 12px;
  background: var(--surface-3);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.input:focus-visible {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-muted);
}
.input::placeholder { color: var(--text-tertiary); }
.input[disabled] { opacity: 0.5; cursor: not-allowed; }
```

#### Form Layout 표준
```
Label (text-xs uppercase tracking-wide text-secondary, mb-1.5)
↓
Input (h-9)
↓
Helper / Error (text-xs text-tertiary, mt-1.5)
```

### 7.4 Badge / StatusBadge

#### Pill 스타일 통일
```css
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  height: 22px; padding: 0 10px;
  border-radius: 9999px;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid;
}
```

#### Status 매핑 (4 그룹으로 단순화)

```
┌──────────┬──────────────────────┬────────────────────────────────────┐
│ Group    │ Style                │ States                             │
├──────────┼──────────────────────┼────────────────────────────────────┤
│ success  │ bg-success/10        │ confirmed, active, paid, settled,  │
│          │ text-success         │ present, available, completed,     │
│          │ border-success/25    │ checked_in, clean, issued          │
├──────────┼──────────────────────┼────────────────────────────────────┤
│ warning  │ bg-warning/10        │ tentative, pending, partially_paid,│
│          │ text-warning         │ in_progress, late, maintenance,    │
│          │ border-warning/25    │ outcall, half_day                  │
├──────────┼──────────────────────┼────────────────────────────────────┤
│ danger   │ bg-danger/10         │ cancelled, no_show, void, absent,  │
│          │ text-danger          │ dirty, occupied, blacklisted       │
│          │ border-danger/25     │                                    │
├──────────┼──────────────────────┼────────────────────────────────────┤
│ neutral  │ bg-surface-3         │ checked_out, inactive, draft,      │
│          │ text-secondary       │ day_off, closed, archived          │
│          │ border-default       │                                    │
└──────────┴──────────────────────┴────────────────────────────────────┘
```

> 변경: 기존 7 그룹 (성공/진행중/경고/주의/오류/비활성/특수) → **4 그룹**. `incall/outcall`은 텍스트로 표현하고, 색상 구분은 success/warning만으로 충분.

#### Dot Indicator (선택)
실시간 상태(룸보드)는 도트로:
```html
<span class="badge badge-success">
  <span class="h-1.5 w-1.5 rounded-full bg-success animate-pulse"></span>
  Occupied
</span>
```

### 7.5 Dialog / Modal

```html
<!-- Overlay -->
<div class="fixed inset-0 bg-surface-overlay backdrop-blur-sm
            data-[state=open]:animate-in data-[state=open]:fade-in-0" />

<!-- Panel -->
<div class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            w-full max-w-lg rounded-xl border border-subtle bg-surface-1
            p-6 shadow-dialog
            data-[state=open]:animate-in data-[state=open]:zoom-in-95
            data-[state=open]:fade-in-0" />
```

### 7.6 Tooltip / Popover
```
Tooltip:  bg-surface-3 border-default text-xs px-2 py-1 rounded-md
Popover:  bg-surface-1 border-default rounded-lg shadow-popover p-3
```

---

## 8. 테이블 (Table System) — Linear 스타일

> **테이블은 Admin 대시보드의 핵심.** 통일된 패턴 필수.

### 8.1 핵심 원칙
1. **가로 보더만** — 세로 분리선 없음 (Excel 느낌 방지)
2. **No zebra striping** — 줄바꿈 색상 교차 사용 안 함
3. **Hover 단일 색** — `bg-surface-3`로만 표시
4. **숫자는 우측정렬 + tabular-nums** — 세로 정렬 일치
5. **헤더는 uppercase tracking-wide** — 데이터와 구분

### 8.2 표준 마크업

```html
<div class="rounded-lg border border-subtle overflow-hidden">
  <table class="w-full">
    <thead class="bg-surface-1 border-b border-subtle">
      <tr>
        <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase
                   tracking-wider text-tertiary">
          Room
        </th>
        <th class="px-4 py-3 text-left ...">Guest</th>
        <th class="px-4 py-3 text-right ...">Amount</th>
        <th class="px-4 py-3 text-right ...">Status</th>
        <th class="w-12"></th> <!-- 액션 컬럼 -->
      </tr>
    </thead>
    <tbody>
      <tr class="border-b border-subtle hover:bg-surface-3
                 transition-colors duration-100">
        <td class="px-4 py-3 text-sm font-medium">VIP-3</td>
        <td class="px-4 py-3 text-sm text-secondary">Tan Wei Ming</td>
        <td class="px-4 py-3 text-right font-mono tabular-nums">RM 1,240.00</td>
        <td class="px-4 py-3 text-right">
          <span class="badge badge-success">Active</span>
        </td>
        <td class="px-4 py-3 text-right">
          <button class="ghost icon">⋯</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 8.3 행 높이 (Row Density)
```
Comfortable (default):  py-3  (52px row)   → 일반 리스트
Compact:                py-2  (40px row)   → 데이터 헤비 (POS, 거래내역)
Spacious:               py-4  (60px row)   → 카드형 정보
```

### 8.4 컬럼 타입별 정렬
| 컬럼 타입 | 정렬 | 폰트 |
|---|---|---|
| 텍스트 (이름, 룸명) | `text-left` | Inter |
| 상태 (Badge) | `text-right` | — |
| 숫자 (금액, 수량, 시간) | `text-right` | `font-mono tabular-nums` |
| 액션 버튼 | `text-right` | — |
| 날짜 | `text-left` | `font-mono tabular-nums` |

### 8.5 빈 상태 (Empty State)
```html
<div class="py-16 text-center">
  <div class="font-display text-2xl text-tertiary mb-2">No sessions yet</div>
  <p class="text-sm text-secondary mb-6">
    Start by creating a new reservation.
  </p>
  <button class="primary">+ New Reservation</button>
</div>
```

### 8.6 페이지네이션 / 무한스크롤
- 50건 미만: 한 화면
- 50~500건: 페이지네이션 (`Prev | 1 2 ... | Next`)
- 500건 초과: 가상 스크롤 (TanStack Virtual)

### 8.7 정렬 / 필터 UI
헤더 클릭 정렬 표시: `↑ ↓` 화살표 (골드 컬러 적용 가능 — 활성 상태 표시)

---

## 9. 페이지 레이아웃 (Page Templates)

### 9.1 통일된 페이지 구조
**모든 Admin 페이지는 다음 구조를 따른다:**

```html
<main class="p-6 md:p-8 space-y-8">

  <!-- ① Page Header (필수) -->
  <header class="flex items-end justify-between gap-4">
    <div>
      <p class="text-xs uppercase tracking-wide text-tertiary mb-1.5">
        Operations
      </p>
      <h1 class="font-display text-3xl md:text-4xl font-medium tracking-tight">
        Reservations
      </h1>
      <p class="text-sm text-secondary mt-1.5">
        Manage today's bookings and walk-ins.
      </p>
    </div>
    <div class="flex gap-2">
      <button class="secondary">Export</button>
      <button class="primary">+ New Reservation</button>
    </div>
  </header>

  <!-- ② KPI Strip (선택, 대시보드형 페이지) -->
  <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <KpiCard label="Sessions Today" value="34" delta="+12%" />
    <KpiCard ... />
  </section>

  <!-- ③ Filter Bar (테이블이 있는 페이지) -->
  <section class="flex flex-wrap items-center gap-3">
    <SearchInput />
    <FilterDropdown />
    <DateRangePicker />
  </section>

  <!-- ④ Main Content (테이블/그리드/폼) -->
  <section>...</section>

</main>
```

### 9.2 사이드바 + 메인 비율
```
Sidebar:  240px 고정 (변경: 256px → 240px, Linear 표준)
Main:     flex-1, max-w 없음 (대시보드는 화면 전체 활용)
Form 페이지:  max-w-2xl (672px) 중앙 정렬
Detail 페이지: max-w-4xl (896px) 중앙 정렬
```

---

## 10. 사이드바 (Sidebar) — 통일 패턴

### 10.1 구조
```
┌─────────────────────────────┐
│ [KL]  KL Entertainment              │  ← 로고 영역 (h-16, border-b-subtle)
│       MANAGEMENT            │
├─────────────────────────────┤
│                             │
│  PERSONAL                   │  ← 카테고리 라벨 (text-xs uppercase tertiary)
│  ▸ Profile                  │
│  ▸ Notifications            │
│                             │
│  DASHBOARDS                 │
│  ▸ Overview                 │
│  ▸ Real-time Board          │  ← 활성: 좌측 2px 골드 라인 + bg-surface-3
│                             │
│  OPERATIONS                 │
│  ▸ Reservations             │
│  ▸ Rooms                    │
│  ...                        │
├─────────────────────────────┤
│ [Avatar] User Name          │  ← 유저 영역 (border-t-subtle)
│          STORE_MANAGER      │
└─────────────────────────────┘
```

### 10.2 카테고리별 색상 — **제거**
> ❌ Personal=슬레이트, Dashboards=보라, Operations=앰버 등 색상 구분 **전면 제거.**
> ✅ 카테고리 구분은 **라벨 텍스트 + 여백**으로만:

```css
/* 카테고리 헤더 */
.nav-category {
  padding: 16px 16px 8px;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--text-tertiary);
}
/* 카테고리 간 여백 */
.nav-category + .nav-category { margin-top: 16px; }
```

### 10.3 활성 아이템 표시
```css
.nav-item {
  display: flex; align-items: center; gap: 10px;
  height: 36px; padding: 0 12px; border-radius: 6px;
  font-size: 13px; font-weight: 500;
  color: var(--text-secondary);
  position: relative;
  transition: background 100ms, color 100ms;
}
.nav-item:hover { background: var(--surface-3); color: var(--text-primary); }
.nav-item.active {
  background: var(--surface-3);
  color: var(--text-primary);
}
.nav-item.active::before {
  content: '';
  position: absolute; left: -8px; top: 8px; bottom: 8px;
  width: 2px; background: var(--gold);
  border-radius: 2px;
}
```

> 변경: `layoutId` 기반 spring 애니메이션 → **단순 상태 변경**. 페이지 전환 시 좌측 골드 라인 페이드인 (200ms).

---

## 11. 애니메이션 (Motion) — 미니멀

### 11.1 원칙
- **Duration**: 100~200ms (인터랙션), 250~350ms (페이지 전환)
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) 또는 `ease-out`
- **Spring 애니메이션은 토글/드로어에만** — 일반 hover, 활성 상태는 CSS transition
- **prefers-reduced-motion 대응 필수**

### 11.2 표준 모션 토큰
```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### 11.3 표준 애니메이션 매핑
| 요소 | 애니메이션 |
|---|---|
| Hover (button, row, link) | `transition-colors duration-100` |
| Focus ring | `transition-shadow duration-100` |
| 페이지 전환 | `opacity 0→1`, `200ms ease-out` (y 이동 제거) |
| Dialog 열림 | `fade-in + zoom-95→100`, `200ms ease-out` |
| Drawer (모바일 사이드바) | spring `stiffness:400 damping:35` |
| Toast | `slide-in-right + fade`, `250ms ease-out` |
| Skeleton | `pulse 1.5s ease-in-out infinite` |
| Real-time room 상태 변경 | `bg-flash 600ms` (배경 골드/10에서 페이드) |

> 변경: 페이지 전환 `y: 12→0` **제거**. Linear/Vercel은 페이지 전환 모션 없음 — 정밀함이 우선.

### 11.4 ❌ 금지 모션
- 무한 루프 회전, 펄스(상태 도트 제외)
- Hover 시 scale 변경 (1.05 등) — 럭셔리 아님
- 페이지 입장 시 stagger (요소들이 순차 등장) — 산만함

---

## 12. KPI 카드 (Dashboard 컴포넌트)

대시보드 통일성의 핵심. **모든 KPI는 이 패턴으로:**

```html
<div class="rounded-lg border border-subtle bg-surface-2 p-5">
  <div class="flex items-start justify-between">
    <p class="text-xs uppercase tracking-wide text-tertiary">
      Revenue Today
    </p>
    <Icon class="h-4 w-4 text-tertiary" />
  </div>
  <div class="mt-3 flex items-baseline gap-2">
    <span class="font-display text-3xl font-medium">RM 12,480</span>
    <span class="text-xs text-success">+12.4%</span>
  </div>
  <p class="mt-1 text-xs text-tertiary">vs yesterday</p>
</div>
```

핵심 KPI(메인 메트릭) 1개에만 골드 적용 가능:
```html
<span class="font-display text-3xl font-medium text-gold">RM 12,480</span>
```

---

## 13. 다국어 (i18n) & 로케일

지원: `EN / 中文(简) / 中文(繁) / BM / TH / KR / JA` (7개)

### 13.1 텍스트 길이 변화 대응
```
짧은 언어:  EN, ZH ("Save", "保存")
긴 언어:    DE, MS ("Simpan", 약 1.2x)
가장 긴 언어: TH ("บันทึก", 1.4x — 줄바꿈 잦음)
```
- 버튼 라벨은 `min-width: 80px` 보장
- 테이블 컬럼은 `truncate` 대신 `text-wrap` + `line-clamp-2` 권장 (이름 잘림 방지)

### 13.2 폰트 폴백
```css
font-family: 'Inter', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans KR',
             'Noto Sans JP', 'Noto Sans Thai', sans-serif;
```
> Playfair Display는 라틴 전용. **CJK/태국어에선 Noto Serif로 폴백**:
```css
.font-display:lang(ko), .font-display:lang(ja), .font-display:lang(zh),
.font-display:lang(th) {
  font-family: 'Noto Serif KR', 'Noto Serif JP', 'Noto Serif SC',
               'Noto Serif Thai', serif;
}
```

### 13.3 숫자/날짜/통화 포맷
```js
// utils/format.ts
formatCurrency(1240, { currency: 'MYR', locale: 'en-MY' }) // RM 1,240.00
formatDate(date, { locale: 'en-GB' })   // 02 Jan 2026
formatDate(date, { locale: 'ko-KR' })   // 2026. 01. 02.
formatDate(date, { locale: 'th-TH' })   // 02/01/2026 (불교력 옵션 별도)
formatTime(date)                         // 21:30 (24h, 모든 로케일)
```

---

## 14. 접근성 (Accessibility)

| 항목 | 요구사항 |
|---|---|
| 색상 대비 | text-primary on surface-base ≥ **15:1** ✅ |
| 색상 대비 | text-secondary on surface-2 ≥ **7:1** ✅ |
| 색상 대비 | gold on surface-base ≥ **6.5:1** ✅ (테스트 완료) |
| 포커스 표시 | 모든 인터랙티브 요소에 `focus-visible` ring (3px gold-muted) |
| 키보드 네비 | Tab 순서 논리적, Esc로 모달 닫힘, Enter로 폼 제출 |
| ARIA | 테이블 `<table>` 시멘틱 사용, `aria-sort` 정렬 상태, `aria-live` 토스트 |
| 모션 감소 | `prefers-reduced-motion` 대응 (11.2 참고) |
| 색맹 대응 | 상태 표시는 색 + 아이콘/텍스트 함께 (success ✓, danger ✕) |

---

## 15. 다크 테마 전용 — 라이트 테마는 향후 결정

KL Project는 **현재 다크 전용**. 라이트 테마는 v4.0 로드맵.

> ⚠️ 모든 토큰은 `:root`에 정의하되, 추후 라이트 테마 추가 시 `[data-theme="light"]` 오버라이드 가능하도록 설계.

---

## 16. 적용 체크리스트 (모든 새 페이지/컴포넌트)

```
□ 헤더가 Page Header 패턴(§9.1)을 따르는가?
□ 페이지당 Primary 버튼이 1~2개 이하인가?
□ 사용된 색상이 토큰(§2.2) 안에 있는가?
□ 그라데이션이 0개인가?
□ Playfair Display가 h1과 로고에만 쓰였는가?
□ 숫자가 font-mono tabular-nums인가?
□ 테이블에 세로 보더가 없는가?
□ Hover 색상이 surface-3로 통일되어 있는가?
□ 카테고리별 색상이 사용되지 않았는가?
□ 모든 인터랙티브 요소에 focus-visible이 있는가?
□ 로딩/빈 상태/에러 상태가 정의되어 있는가?
□ 모바일(375px)에서 깨지지 않는가?
□ 다국어 텍스트 1.4x 길이에서도 깨지지 않는가?
□ prefers-reduced-motion 대응되어 있는가?
```

---

## 17. 마이그레이션 가이드 (v2.0 → v3.0)

기존 코드를 깨뜨리지 않으면서 점진 전환하는 방법.

### 17.1 단계
```
Phase 1 (Week 1): 토큰 레이어
  - 새 CSS 변수(§2.2) 추가, 기존 변수 alias 처리
  - 예: --color-primary → var(--gold) (alias)

Phase 2 (Week 2~3): 컴포넌트 리팩토링
  - Button: 6 variants → 4 variants (link, outline 통합)
  - Card: backdrop-blur 제거, bg-surface-2로
  - Badge: 7 그룹 → 4 그룹 매핑 테이블

Phase 3 (Week 4): 페이지 레이아웃
  - Page Header 패턴 통일
  - 사이드바 카테고리 색상 제거

Phase 4 (Week 5): 검증
  - 모든 페이지 §16 체크리스트 통과
  - 다국어 7개 시각 검수
```

### 17.2 호환성 주의
```js
// 기존 코드 보호 — 토큰 alias로 점진 전환
:root {
  --color-primary: var(--gold);                    // alias
  --color-primary-foreground: var(--gold-foreground);
  --color-card: var(--surface-2);
  --color-background: var(--surface-base);
  // ... 기존 변수명 그대로 유지하되 새 토큰 가리키게
}
```

> ⚠️ **Add Only Rule** 준수 — 기존 클래스/변수 삭제 금지. 새 시스템 구축 후 deprecation 주석으로 마킹.

---

## 18. 참고 디자인 시스템 (Reference)

| 시스템 | 차용 포인트 |
|---|---|
| **Linear** | 사이드바 패턴, 테이블, 활성 인디케이터 |
| **Vercel** | 타이포 위계, 페이지 헤더, 보더 시스템 |
| **Stripe Dashboard** | KPI 카드, 데이터 밀도, 폼 레이아웃 |
| **Arc Browser** | 모션 절제, "조용한" 인터랙션 |
| **Notion** | 빈 상태, 인라인 액션 |
| **Apple HIG (Vision Pro)** | 깊이감 (보더 위계), 다크 톤 시스템 |

---

## 19. 다음 작업

- [ ] `tailwind.config.ts`에 §2.2 토큰 매핑
- [ ] `globals.css` Reset + 토큰 + 스크롤바
- [ ] 컴포넌트 라이브러리 리팩토링 (Button, Badge, Card, Input, Table)
- [ ] Storybook (또는 컴포넌트 갤러리 페이지) 구축 — `/admin/_design`
- [ ] 디자인 토큰 → Figma Variable Sync (선택)

---

*Version: 3.0 · Quiet Luxury Edition*
*Project: KL Entertainment Karaoke Management System*
*Last Updated: 2026-05-08*
*기존 v2.0 코드는 §17 마이그레이션 가이드에 따라 점진 전환*
