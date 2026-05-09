# KL Project — Finance Workflow (Claude Code Reference)

> **문서 목적**: Claude Code가 KL Project(다국적 카라오케 PMS)의 파이낸스 시스템을 정확히 이해하고 코드를 작성·수정·디버그할 수 있도록 만든 **개발 참조 문서**.
>
> **버전**: v2.0 (TS/Drizzle 기준 재작성)
> **현재 스택** (실측): pnpm monorepo · TypeScript · Express 5 · Drizzle ORM · PostgreSQL · Socket.io · React + Vite + Tailwind + Shadcn UI · TanStack Query · Zustand · Wouter · Orval(OpenAPI) + Zod · JWT + RBAC
> **타겟 시장**: Malaysia(KL) · Thailand · Singapore · Korea · China
> **최종 갱신**: 2026-05-08

---

## 📑 Table of Contents

0. 문서 사용법 (Claude Code Guide)
1. Finance System Overview
2. 3대 사이클 (Operations / Payroll / Investor)
3. Core Modules 상세
4. 역할별 워크플로우 (Role-based Workflows)
5. RBAC Permission Matrix
6. Data Flow Diagrams
7. Edge Cases & 도메인 주의사항
8. TypeScript 구현 가이드라인 (Drizzle / Express / Socket.io)
9. Glossary & Status Codes

---

## 0. 문서 사용법

### Claude Code가 이 문서를 사용하는 방법

| 작업 유형 | 우선 참조 섹션 |
|---|---|
| 새 기능 추가 (예: 새 결제 수단) | §3 Core Modules → §6 Data Flow → §7 Edge Cases |
| 버그 수정 (예: 커미션 계산 오류) | §3.7 Ledger → §7 Edge Cases → §4 역할별 워크플로우 |
| RBAC 권한 추가/수정 | §5 RBAC Matrix → §4 해당 역할 워크플로우 |
| 보고서 추가 | §3.5/3.6 Reports → §6 Data Flow |
| Drizzle 스키마/서비스 구현 | §8 TS 구현 가이드라인 |

### 코딩 시 절대 규칙 (Hard Rules)

1. **Add Only Rule**: 기존 동작 코드는 절대 삭제하지 않음. 항상 additive로 변경.
2. **Soft Delete Only**: Folio·Invoice·Order·Reservation은 삭제 금지. `is_void`, `status='cancelled'` 등 상태로 처리.
3. **Audit Trail Mandatory**: 모든 금액 변동(POS, Folio 항목 추가/Void, Payment, Ledger Entry, Payslip 발행)은 `created_by`, `created_at`, `reason` 기록.
4. **Money = Decimal, Never Float**: 금액은 PostgreSQL `numeric(12,2)`. Drizzle 컬럼은 `numeric({ precision: 12, scale: 2, mode: 'string' })`로 선언하여 JS `number` 변환을 막고, 산술은 `decimal.js` 또는 정수 cent로. **`Number` 곱셈/덧셈 금지**.
5. **Currency Tagged**: 모든 금액 컬럼은 `currency` 컬럼과 페어. `total_amount` 단독 저장 금지.
6. **Tenant + Branch Scoped**: 모든 쿼리는 `tenant_id` + `branch_id` 필터 필수. RLS 적용 권장.
7. **UTC In, Local Out**: DB 저장은 UTC `timestamptz`, 표시는 venue `timezone` 기준 변환.
8. **Validation at Edge**: Express 핸들러 진입 시 Zod(Orval 생성 스키마) 검증 통과한 데이터만 서비스 레이어로 전달.

---

## 1. Finance System Overview

### 1.1 시스템 구조 (6 Layers)

```
┌─────────────────────────────────────────────────────────────┐
│  L6  Investor / Shareholder Layer                          │
│      (월간 리포트, 지분율 × 순이익, 정산)                    │
├─────────────────────────────────────────────────────────────┤
│  L5  Reporting & Analytics Layer                           │
│      (Daily Report, Reports 4탭, P&L, KPI)                 │
├─────────────────────────────────────────────────────────────┤
│  L4  Payroll Layer                                         │
│      (Ledger Entries → Payslip → Payout Resolution)        │
├─────────────────────────────────────────────────────────────┤
│  L3  Settlement Layer                                      │
│      (Invoice ↔ Payments ↔ Receipt)                        │
├─────────────────────────────────────────────────────────────┤
│  L2  Charging Layer                                        │
│      (Folio + folio_entries: 실시간 청구 누적)              │
├─────────────────────────────────────────────────────────────┤
│  L1  Source Events Layer                                   │
│      (Reservation, POS Order, Hostess Session, Pickup)     │
└─────────────────────────────────────────────────────────────┘
```

**핵심 원칙**: 하위 레이어는 상위 레이어를 모름. 상위 레이어는 하위 데이터를 **집계만** 함 (이중 기록 금지).

### 1.2 핵심 엔티티 관계 (단순화 ERD)

```
Reservation (1) ──┬── (1) Folio ──┬── (N) folio_entries
                  │                │      ├─ room_charge
                  │                │      ├─ pos_item
                  │                │      ├─ hostess_charge
                  │                │      ├─ outcall_fee
                  │                │      ├─ late_charge
                  │                │      ├─ sst / service_charge
                  │                │      ├─ discount (음수)
                  │                │      └─ other
                  │                │
                  │                └── (N) Invoice ──┬── (N) payments
                  │                                  └── (1) receipt
                  │
                  ├── (N) pos_orders ── (N) order_items
                  ├── (N) hostess_assignments
                  └── (N) pickup_jobs

Staff ── (N) ledger_entries ── (N) payslips ── (1) payout_resolution
Shareholder ── (N) shareholder_settlements (월간)
Branch ── (1) tax_config (SST/GST/VAT 분기별 조정)
```

### 1.3 Money Sources & Sinks

| Source (수익) | Sink (비용/지출) |
|---|---|
| Room Charge | Staff Salary (base + OT) |
| POS Sales (F&B / Package) | Staff Commission (session/drink/package) |
| Hostess Service Fee | Agent Commission |
| Outcall Fee | Agency Fees (agency model) |
| Pickup Fee | Pickup Cost (driver fee) |
| Late Charge / Extension | Operating Expenses |
| Corkage / Misc | Refund / Comp |
|  | Tax Payable (SST/VAT/GST) |
|  | Shareholder Payout |

⚠️ **KARAOKE OPS CONSIDERATION**: "Hostess Service Fee"는 **수익**이지만, 같은 호스티스에 대한 "Hostess Commission"은 **비용**임. 같은 세션에서 양방향으로 흐른다는 점에서 P&L 계산 시 이중계산 사고가 발생하기 쉬움. `folio_entries.hostess_charge`(매출)와 `ledger_entries.commission_session`(비용)은 반드시 **별도 트랜잭션**으로 기록.

---

## 2. 3대 사이클

### 2.1 Operations Cycle (예약 → 정산)

```
[Reservation Created]
        ↓
[Check-in] ──→ Folio 개설 (status: open)
        ↓
[POS Order / Hostess Session / Service]
        ↓ (실시간 자동 적산)
[folio_entries 누적]
        ↓
[Check-out 요청]
        ↓
[Folio Finalize] ──→ Invoice 생성 (draft → issued)
        ↓
[Payment 처리] ──→ Invoice (partially_paid → paid)
        ↓
[Receipt 자동 발행] (조건: amount_paid >= total_amount)
        ↓
[Daily Report 집계]
        ↓
[Monthly Reports 집계]
```

**트리거 이벤트** (Socket.io):
- `folio:entry_added` — 항목 추가 시 룸 보드 + Folio 화면 즉시 갱신
- `invoice:status_changed` — 결제 화면 + 매니저 대시보드
- `payment:received` — 회계 화면 + Daily Report 카운터
- `receipt:generated` — 고객 WhatsApp 발송 트리거

### 2.2 Payroll Cycle (급여)

```
[Source Events 발생]
   ├─ POS Order finalized → drink/package commission 후보
   ├─ Hostess Session ended → session commission 후보
   ├─ Pickup Job completed → pickup_fee 후보
   └─ Attendance posted → base_salary / penalty / overtime 후보
        ↓
[Nightly Batch 실행 (00:30 venue local time)]
        ↓
[ledger_entries 자동 생성 (status: posted)]
        ↓
[월말: generatePayslip()]
        ↓
[payslip 생성 (status: draft)]
        ↓
[issuePayslip() → status: issued]
        ↓
[직원 acknowledge → status: acknowledged]
        ↓
[Payout Resolution 승인]
        ↓
[실지급 → status: paid]
```

**Idempotency Key**: 동일 source event(예: 동일 `pos_order_id`)에 대한 ledger entry 중복 생성 방지를 위해 `(source_type, source_id, ledger_type)` UNIQUE 제약 필수.

### 2.3 Investor Cycle (월간)

```
[월말 마감 + 익월 5일까지 expense 입력]
        ↓
[Monthly P&L 확정]
        ↓
[Net Profit = Gross Revenue − Total Expenses]
        ↓
[Shareholder별 배당 계산]
   payout = net_profit × equity_share_percent × branch_share_percent
        ↓
[shareholder_settlements 생성 (status: draft)]
        ↓
[Admin 검토 → pending → approved]
        ↓
[은행 송금 처리 → paid]
        ↓
[Investor Dashboard 자동 갱신]
```

📈 **BUSINESS IMPACT**: 투자자에게 **월 5일 마감, 월 10일 배당 확정, 월 15일 송금** 같은 SLA를 약속할 수 있으면 신뢰도 급상승. 카라오케 업계는 정산이 늦거나 불투명한 곳이 대다수라 차별화 포인트.

---

## 3. Core Modules 상세

### 3.1 Folio — 예약별 실시간 청구 장부

**역할**: 체크인 ~ 체크아웃 사이의 모든 청구 항목을 실시간 누적하는 "달리는 영수증".

**Schema (PostgreSQL DDL)**:
```sql
folios (
  id, tenant_id, branch_id, reservation_id,
  status,        -- 'open' | 'closed' | 'voided'
  currency,      -- 'MYR' | 'THB' | 'SGD' ...
  subtotal, discount_total, tax_total, total,
  opened_at, closed_at,
  created_by, updated_by,
  UNIQUE (reservation_id) -- 1 reservation : 1 folio
)

folio_entries (
  id, folio_id,
  entry_type,    -- room_charge|pos_item|hostess_charge|outcall_fee|
                 -- late_charge|sst|service_charge|discount|other
  description,
  quantity, unit_price, amount,   -- amount = quantity * unit_price
  source_type, source_id,         -- 'pos_order_item', uuid
  is_void, void_reason, voided_by, voided_at,
  created_at, created_by
)
```

**Drizzle 스키마 패턴** (`lib/db/src/schema/finances.ts` 와 정합):
```ts
import { pgTable, uuid, text, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';

export const folios = pgTable('folios', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  reservationId: uuid('reservation_id').notNull().unique(),
  status: text('status').$type<'open' | 'closed' | 'voided'>().notNull(),
  currency: text('currency').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2, mode: 'string' }).notNull(),
  // ... mode:'string' 으로 number 자동 변환 차단
});
```

**Entry 유형별 자동/수동**:

| 유형 | 자동/수동 | 트리거 |
|---|---|---|
| `room_charge` | 자동 | 체크인 시 / 시간 연장 시 |
| `pos_item` | 자동 | POS Order finalize 시 |
| `hostess_charge` | 자동 | 호스티스 세션 종료 시 (10분 룰 적용) |
| `outcall_fee` | 수동 | 매니저 등록 |
| `late_charge` | 수동/자동 | 시간 초과 감지 시 |
| `sst` / `service_charge` | 자동 | Folio finalize 시 (branch tax_config 기반) |
| `discount` | 수동 | 매니저 승인 (음수 amount) |
| `other` | 수동 | 자유 등록 |

**Operations**:
- `POST /folios/:id/entries` — 항목 추가
- `POST /folio_entries/:id/void` — 소프트 취소 (`is_void=true` + reason 필수)
- `GET /folios/:id` — 30초 자동 새로고침(TanStack Query) → Socket.io `folio:entry_added` push로 즉시 invalidate
- 합계 재계산: `is_void=false` 항목만 합산

⚠️ **KARAOKE OPS CONSIDERATION**:
- **체크아웃 후 추가 청구**: 손님 떠난 후 발견된 미니바 소비, 분실/파손 → Folio가 closed 된 후 추가 청구는 **별도 supplemental_invoice**로 처리. 기존 Folio 재오픈 금지(감사 추적 손상).
- **Split Billing**: 같은 룸 4명이 각자 결제 → Folio는 **1개 유지**, Invoice를 **N개로 분할**(`folio_id` + `split_index`). Folio를 N개로 만들면 룸 매출 이중계산 발생.

🏗️ **IMPLEMENTATION NOTE**: Folio를 `FolioService` 클래스(또는 함수 모듈)로 캡슐화. Entry 추가/Void는 Drizzle 트랜잭션 내에서 (1) row insert/update (2) folio 합계 재계산 (3) `folio:entry_added` Socket.io emit 까지 한 단위로 처리. 외부에서 `folio_entries`를 직접 INSERT 하지 못하도록 RBAC + 코드 컨벤션으로 차단.

---

### 3.2 POS — Point of Sale

**플로우**:

```
1. createOrder(reservation_id) → orders (status: 'open')
2. addItem(order_id, product_id, qty) → order_items
3. applyDiscount(order_id, percent) → discount_amount 계산
4. addHostessCharge(order_id, hostess_id, minutes) → 10분 룰 적용
5. finalize(order_id) → status: 'finalized', finalized_at 기록
                     → folio_entries(pos_item) 자동 생성
6. processPayment(order_id, method, amount) → payments 기록
                                            → invoice 상태 갱신
7. (전액 결제 시) generateReceipt(invoice_id)
```

**상태 전이**:
```
open → finalized → settled
        ↘ voided (관리자 권한, reason 필수)
```

**결제 수단**: `cash` / `card` / `bank_transfer` / `online`

**Online 세부 분기** (multinational):
| 국가 | 지원 채널 |
|---|---|
| Malaysia | FPX, Touch'n Go, GrabPay, Boost, DuitNow QR |
| Thailand | PromptPay QR, TrueMoney |
| Singapore | PayNow, GrabPay |
| Korea | Toss, KakaoPay (예정) |

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Finalize 후 수정 불가** 정책은 회계 무결성 필수. 수정 필요 → **새 order 생성 + 기존 order void**.
- **호스티스 청구 10분 룰**: `잔여분 < 10min ⇒ floor`, `잔여분 >= 10min ⇒ ceil`. 이 로직은 **반드시 server-side**로 강제. 클라이언트 계산값 신뢰하면 분쟁 발생.

```ts
// lib/finance/hostess-charge.ts — 단일 진실 소스
export function calculateBilledHours(sessionMinutes: number): number {
  const hours = Math.floor(sessionMinutes / 60);
  const remainder = sessionMinutes % 60;
  return remainder >= 10 ? hours + 1 : hours;
}
```

이 함수는 라이브러리(`lib/finance`)에 두고 api-server·web-app 양쪽에서 동일하게 import. 단위 테스트 필수.

---

### 3.3 Invoice — 청구서 생명주기

**상태 전이**:
```
draft  →  issued  →  partially_paid  →  paid
                                      ↘  void (취소, 감사 추적 보존)
```

| 상태 | 색상 | 의미 |
|---|---|---|
| `draft` | 회색 | 작성 중, 미발행 |
| `issued` | 파랑 | 발행 완료, 결제 대기 |
| `partially_paid` | 노랑 | 일부 결제 완료 |
| `paid` | 초록 | 전액 결제 완료 |
| `void` | 빨강 | 취소 (감사 추적 보존) |

**필드**:
| 필드 | 타입 | 설명 |
|---|---|---|
| `invoice_no` | text | `INV-{branch}-{YYYYMM}-{seq}` 형식 |
| `subtotal` | numeric(12,2) | 할인 전 합계 |
| `discount_amount` | numeric(12,2) | 할인 합계 |
| `tax_amount` | numeric(12,2) | SST/VAT/GST |
| `total_amount` | numeric(12,2) | 최종 청구액 |
| `amount_paid` | numeric(12,2) | 누적 수납액 |
| `balance_due` | numeric(12,2) | `total_amount - amount_paid` |
| `currency` | char(3) | ISO 4217 |
| `tax_config_snapshot` | jsonb | **세율 변경 대비 발행 시점 세율 스냅샷** |

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Tax Config Snapshot**: 발행 후 정부가 SST 6% → 8%로 인상하면, 과거 인보이스도 8%로 보이는 버그 발생 가능. `tax_config_snapshot` jsonb로 발행 시점 세율을 박제할 것.
- **Invoice No 채번**: branch 단위 sequence를 PostgreSQL `sequence`로 두면 운영 편함. `INV-KL01-202603-00042` 형태.
- **Receipt vs Tax Invoice**: 말레이시아 SST 등록 사업자는 **Tax Invoice**를 별도로 발행해야 함 (LHDN 규정). `invoice_type` 컬럼으로 구분.

---

### 3.4 Payments — 결제 처리

**트랜잭션 안전 처리** (Drizzle `db.transaction`):

```
BEGIN
  1. SELECT invoice FOR UPDATE  -- 락 획득 (동시 결제 방지)
  2. assert invoice.status != 'void'
  3. assert payment_amount <= balance_due  -- 과납 방지
  4. INSERT payments
  5. UPDATE invoice.amount_paid += payment_amount
  6. UPDATE invoice.status (partially_paid / paid)
  7. IF invoice.amount_paid >= invoice.total_amount:
       INSERT receipt
  8. EMIT Socket.io 'payment:received'
COMMIT
```

Drizzle 예시:
```ts
await db.transaction(async (tx) => {
  const invoice = await tx
    .select().from(invoices)
    .where(eq(invoices.id, invoiceId))
    .for('update')                            // SELECT ... FOR UPDATE
    .then(rows => rows[0]);
  // ... assertions, insert, update
});
io.to(`branch:${branchId}`).emit('payment:received', payload);
```

**API 응답 형식**:
```json
{
  "payment": { "id": "...", "amount": "450.00", "method": "cash" },
  "invoice_status": "paid",
  "balance_due": "0.00",
  "receipt": { "no": "RCPT-KL01-202603-00128", "url": "..." }
}
```

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Cash 결제 = 현금 드로어 이벤트**: 모든 cash payment는 동시에 `cash_drawer_movements` 기록. 마감 시 실물 현금과 대조.
- **Tip 처리**: 카드 결제 시 팁 별도 입력 → `payments.tip_amount` 컬럼 필수. Folio total과 분리하여 host에게 직접 귀속.
- **Refund**: 환불은 **음수 payment**가 아닌 별도 `refunds` 테이블 권장. 회계상 별도 거래.

📈 **BUSINESS IMPACT**: 카라오케 업계 분쟁 1위는 "결제했는데 안 했다고 한다". Receipt 자동 WhatsApp 발송 + 영구 PDF 링크는 **분쟁율 -70%** 수준의 직접 효과.

---

### 3.5 Daily Sales Report

**구성**:

```
[날짜 선택: YYYY-MM-DD]
        ↓
┌──────────────────────────────────┐
│ Revenue (매출)                    │
│  - Room Charge                   │
│  - POS                           │
│  - Hostess                       │
│  - Outcall                       │
│  - TOTAL                         │
├──────────────────────────────────┤
│ Payments (수납)                   │
│  - Cash Received                 │
│  - Card Received                 │
│  - Bank Transfer Received        │
│  - Online Received               │
│  - TOTAL Received                │
├──────────────────────────────────┤
│ Reconciliation                   │
│  - Outstanding (미수)             │
│  - Cash Drawer Expected vs Actual │
└──────────────────────────────────┘
```

**중요**: Revenue ≠ Payments
- Revenue는 **매출 인식 시점** (Folio finalize)
- Payments는 **현금 유입 시점** (실제 수납)
- 외상 / 분할 결제 / 익일 결제로 인해 둘은 일치하지 않음 → 둘 다 표시 필수

**접근 권한**: SUPER_ADMIN / ADMIN / BRANCH_MANAGER / MANAGER

---

### 3.6 Reports (4 Tabs)

#### Tab 1 — Revenue Analysis

| 지표 | 계산식 |
|---|---|
| Total Revenue | Σ folio_entries.amount WHERE !is_void |
| Total Orders | COUNT(reservations WHERE status IN ('checked_out','closed')) |
| Avg per Order | Total Revenue ÷ Total Orders |
| Daily Trend | GROUP BY DATE(opened_at) — Area Chart (Recharts) |
| By Category | GROUP BY entry_type — Pie Chart (Recharts) |

#### Tab 2 — Occupancy

| 지표 | 계산식 |
|---|---|
| Overall Occupancy | (Σ booked_minutes) ÷ (rooms × operating_minutes) × 100 |
| Total Room Revenue | Σ folio_entries WHERE entry_type='room_charge' |
| By Room | 객실별 점유율 + 수입 — Horizontal Bar |

⚠️ **KARAOKE OPS CONSIDERATION**: `operating_minutes`는 운영시간 기준. 24시간 운영 가정 금지. Branch별 `operating_hours` 설정 필수.

#### Tab 3 — Commissions

| 지표 | 계산식 |
|---|---|
| Total Commission | Σ ledger_entries WHERE entry_type LIKE 'commission_%' |
| Hostess별 | 호스티스별 grouping + 세션·드링크·패키지 분리 |
| Agent별 | 에이전트별 booking 커미션 |

#### Tab 4 — Profit & Loss

```
GROSS REVENUE
  + Room Revenue
  + Hostess Revenue (folio_entries 기준, 매출)
  + Product Revenue (F&B + Package)
  + Pickup Revenue
  + Extension Revenue
  + Other Revenue
  = Gross Revenue

LESS:
  - Cost of Sales (COGS, F&B 원가)
  - Hostess Commission (지급분, 비용)
  - Agent Commission
  - Agency Fees (외부 에이전시 수수료)
  - Staff Salary
  - Operating Expenses (rent, utility, ...)
  = Total Expenses

= Net Profit (before tax)
```

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Hostess Revenue vs Hostess Commission**: 같은 세션에서 매출(고객 청구액)과 비용(호스티스 지급액)이 모두 발생. 둘은 다른 금액(마진은 호스티스 계약별로 다름). 헷갈리면 P&L 망가짐.
- **Agency Model 마진**: agency 호스티스의 경우 venue가 agency에 지급하고, agency가 호스티스에 지급. venue 입장 비용 = `agency_invoice_amount` (NOT 호스티스 commission).

---

### 3.7 Ledger — 개인 원장 시스템

**개념**: 모든 staff (investor 제외)가 개인 원장 보유. 모든 수입·공제가 한 줄씩 기록되는 **append-only ledger**.

**Schema**:
```sql
ledger_entries (
  id, tenant_id, branch_id, staff_id,
  entry_type,
  direction,        -- 'credit' | 'debit'
  amount, currency,
  source_type, source_id,  -- 추적용
  description, period_date,
  status,           -- 'pending' | 'posted' | 'reversed'
  reversal_of,      -- 역분개 시 원본 entry id
  created_at, created_by,
  UNIQUE (source_type, source_id, entry_type)  -- idempotency
)
```

**Credit (수입, 초록색)**:
| 유형 | 설명 |
|---|---|
| `base_salary` | 기본급 |
| `commission_session` | 호스티스 세션 커미션 |
| `commission_drink` | 음료 커미션 |
| `commission_package` | 패키지 커미션 |
| `commission_booking` | 예약 커미션 (에이전트) |
| `bonus` | 보너스 |
| `allowance` | 수당 |
| `overtime` | 초과 근무 수당 |
| `pickup_fee` | 픽업 요금 (드라이버) |
| `tip` | 팁 |

**Debit (공제, 빨간색)**:
| 유형 | 설명 |
|---|---|
| `deduction` | 일반 공제 |
| `penalty` | 패널티 (지각·결근) |
| `advance` | 선급금 |
| `advance_repayment` | 선급금 상환 |
| `agent_deduction` | 에이전트 관련 공제 |

**개인 원장 KPI**:
- `Total CR` = Σ credit (초록)
- `Total DR` = Σ debit (빨강)
- `Net` = Total CR − Total DR (실수령 예상액)

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Reversal 처리**: 잘못 기록된 ledger entry는 **삭제하지 않고** 동일 금액의 반대방향 entry를 `reversal_of` 필드로 연결하여 생성. 회계 감사 통과 가능.
- **Period Boundary**: `period_date`는 영업일 기준. 자정 이후 종료된 세션은 전날 영업일로 귀속할지 결정 필요. `business_date` 컬럼 추가 권장.

---

### 3.8 Payslip — 급여명세서

**플로우**:

```
1. generatePayslip(staff_id, period_start, period_end)
     ↓ 기간 내 posted ledger_entries 집계
   Gross Earnings = Σ credit
   Total Deductions = Σ debit
   Net Payable = Gross − Deductions
     ↓
2. payslips INSERT (status: 'draft')
     ↓
3. issuePayslip() → status: 'issued' (직원에게 공개)
     ↓
4. 직원 acknowledge → status: 'acknowledged'
     ↓
5. payout_resolution 생성 → 실지급 승인
     ↓
6. status: 'paid'
```

**상태**:
| 상태 | 의미 |
|---|---|
| `draft` | 생성 완료, 미발행 |
| `issued` | 직원에게 발행됨 |
| `acknowledged` | 직원 확인 완료 |
| `paid` | 실지급 완료 |

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Lock Period**: payslip이 issued 되면 해당 기간의 ledger_entries는 **잠금**. 추후 수정은 다음 기간 reversal로 처리.
- **Acknowledge가 노동법적 효력**: 한국 PIPA, 말레이시아 PDPA 등에서 급여명세 송부 의무. acknowledge 타임스탬프 보존 필수.

---

### 3.9 Tables / Room Pricing

**공간 유형**:
| 유형 | 색상 |
|---|---|
| `ROOM` | 파랑 |
| `TABLE` | 오렌지 |
| `BOOTH` | 보라 |

**요금 유형**:
| 유형 | 표시 | 설명 |
|---|---|---|
| `PER_HOUR` | /hr | 시간당 |
| `PER_SESSION` | /session | 세션당 정액 |
| `FLAT_RATE` | flat | 고정 요금 |

**상태**:
| 상태 | 색상 | 의미 |
|---|---|---|
| `ACTIVE` | 초록 | 운영 중 |
| `INACTIVE` | 회색 | 비운영 |
| `MAINTENANCE` | 노랑 | 정비 중 |
| `OUT_OF_ORDER` | 빨강 | 사용 불가 |

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Peak/Off-peak 요금**: 카라오케는 21시 이후 요금이 1.5~2x. `pricing_rules` 테이블에서 시간대 기반 multiplier 관리. 단순 단가 X.
- **Happy Hour / Weekday Promo**: `valid_from`, `valid_to`, `day_of_week`, `time_of_day` 필터 필요.

> 현재 코드베이스 기준: `room_tables` + `room_table_pricing` 테이블 + effective price resolution API + Socket.io 실시간 가용성 캘린더.

---

### 3.10 Shareholder Settlements

```
[월간 순이익 확정]
        ↓
[지분율 × 순이익 = 배당 예상액]
   payout_amount = net_profit × equity_share_pct × branch_share_pct
        ↓
[settlement INSERT (status: 'draft')]
        ↓
[검토 → pending → approved → paid]
                     ↘ cancelled
```

**상태**:
| 상태 | 색상 |
|---|---|
| `draft` | 노랑 |
| `pending` | 파랑 |
| `approved` | 초록 |
| `paid` | 회색 |
| `cancelled` | 빨강 |

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Multi-branch Equity**: 한 투자자가 12개 지점에 각각 다른 % 지분 보유 가능. `shareholder_equity` 테이블은 `(shareholder_id, branch_id, equity_pct)` 복합키.
- **Dividend Withholding Tax**: 말레이시아·태국에서 배당 원천세 적용. `tax_withheld` 필드 필수.

---

## 4. 역할별 워크플로우

### 4.1 Super Admin

**스코프**: 플랫폼 전체 (모든 tenant, 모든 branch).

**일상 (Daily)**:
1. 시스템 헬스 체크 → Nightly Batch 성공 여부 확인
2. 전체 지점 매출 현황 모니터링
3. 분쟁 케이스 / 예외 거래 검토

**주간/월간**:
1. Tenant 관리 (생성·정지·삭제)
2. 플랫폼 비용 / 수익 분석
3. Nightly Batch 수동 실행 (`POST /ledger/batch/run`) — 누락분 보정
4. Ledger 감사 (`GET /ledger/audit`) — 이상 패턴 탐지
5. 세율 변경 (정부 정책 변경 시 `tax_configs` 일괄 업데이트)

**전용 권한**:
- Nightly Batch 수동 실행
- Ledger Audit 도구
- 다중 tenant 데이터 조회
- 시스템 설정 (timezone, currency master, language pack)

---

### 4.2 Admin (Chain Owner)

**스코프**: 자신의 tenant 내 모든 branch.

**일상 (Daily)**:
1. **Daily Report 확인** (전 지점 또는 지정 지점)
2. POS·Folio·Invoice 모니터링 → 이상 거래 검토
3. 결제 실패 / 분쟁 케이스 처리

**주간 (Weekly)**:
1. **Reports > Revenue**: 지점간 매출 비교
2. **Reports > Occupancy**: 점유율 저조 지점 파악
3. 호스티스 / 직원 KPI 검토

**월간 (Monthly)**:
1. **Reports > P&L**: 지점별 + 통합 손익 확정
2. **Payslip 생성 / 발행** (모든 지점)
3. **Payout Resolution 승인** (지점별 또는 일괄)
4. **Shareholder Settlement** 생성 → 승인 → 송금

**투자자 관련**:
1. 주주 등록 / 지분율 편집
2. 월간 Investor Report 생성 → 공개
3. 투자자 문의 응대

**제외 사항**:
- 플랫폼 설정 접근 불가
- 다른 tenant 데이터 접근 불가

---

### 4.3 Branch Manager (지점장)

**스코프**: 담당 지점 1개 (또는 N개, `staff_branch_assignments` 기반).

**일상 (Daily)**:
1. **지점장 대시보드**: 오늘 매출 KPI 실시간 모니터링
   - Today's Revenue / Yesterday 비교
   - Active Reservations / Open Folios
   - Hostess Utilization (지금 일하는 호스티스 수 / 출근 호스티스 수)
2. POS·Folio 검토 → 매니저 권한 필요한 항목 승인 (할인, comp, void)
3. 마감 후 **Daily Report** 확인 + Cash Drawer 정산

**주간 (Weekly)**:
1. **Reports > Revenue**: 일별 추이 + Peak time 분석
2. **Reports > Occupancy**: 객실별 점유율 → 저점유 객실 조치 (마케팅 / 가격 조정)
3. 직원 근태 검토

**월간 (Monthly)**:
1. **Reports > Commissions**: 호스티스 / 에이전트 커미션 검토
2. **Reports > P&L**: 지점 손익 → Admin 보고
3. **Payslip 생성 / 발행** (지점 직원)
4. **Payout Resolution 승인**

**제외 사항**:
- 다른 지점 데이터 접근 불가
- 투자자 / Shareholder 관련 메뉴 접근 불가
- 플랫폼 설정 불가

---

### 4.4 Manager (운영 매니저)

**스코프**: 담당 지점 운영 실무.

**Daily**:
1. **POS 운영**:
   - createOrder → addItem → applyDiscount → addHostessCharge → finalize → processPayment
2. **Folio 실시간 관리**:
   - 항목 추가 (수동 entries)
   - 호스티스 청구 검토
   - Discount 신청 (BRANCH_MANAGER 승인 받음)
3. **Invoice 상태 모니터링**: issued → paid 진행 확인
4. **Daily Report**: 당일 마감 점검

**Weekly**:
1. **Reports > Revenue**: 매출 보고서 열람
2. **Reports > Commissions**: 호스티스 / 에이전트 정산 준비

**Monthly**:
1. **Reports > P&L**: 지점 손익 열람

**제외 사항**:
- Payslip 생성 / 발행 불가 (Branch Manager 이상)
- Payout Resolution 승인 불가
- Shareholder 메뉴 접근 불가
- 다른 지점 데이터 접근 불가

---

### 4.5 Hostess (호스티스)

**스코프**: 본인 데이터만.

**Daily**:
1. **호스티스 대시보드**:
   - 오늘 배정 세션 확인 (시간 / 룸 / 게스트 이름 마스킹)
   - 세션 요금 표시: 시간 × 단가 (10분 룰 적용)
   - 지각 분 → 패널티 자동 표시
2. **이번 달 커미션 내역**:
   - 날짜 / 세션 시간 / 단가 / 실수령액 / 공제

**Monthly**:
1. **내 원장 (My Ledger)**:
   - 수입: `commission_session`, `commission_drink`, `tip`, `bonus`
   - 공제: `penalty`, `deduction`, `advance_repayment`
   - Net 잔액 = Total CR − Total DR
2. **Payslip 확인 → Acknowledge**

**호스티스 커미션 계산 로직 (재확인)**:
```
session_minutes = end_time - start_time (지각분 차감 후)
billed_hours = floor(session_minutes / 60)
remainder = session_minutes % 60
if remainder >= 10:
    billed_hours += 1   # 올림
# else: 절사

commission_amount = billed_hours × hourly_rate_guest
```

⚠️ **KARAOKE OPS CONSIDERATION**:
- **호스티스가 가장 자주 보는 화면**: 본인 커미션. 0원이 나오거나 적게 나오면 즉시 매니저 컴플레인 → 분쟁. **계산 로직 투명성**(어떻게 계산되었는지 breakdown) 필수 표시.

**제외 사항**:
- 다른 호스티스 데이터 접근 불가
- 운영 재무 데이터 (Folio / Invoice / Reports) 전체 차단

---

### 4.6 Driver

**스코프**: 본인 픽업 작업 + 본인 원장.

**Daily**:
1. **드라이버 대시보드**:
   - 오늘 픽업 잡 리스트 (시간 / 픽업 주소 / 드롭오프 주소 / 게스트 이름)
   - 잡별 픽업 요금
2. 잡 완료 시 → 픽업 완료 처리 → `pickup_fee` ledger entry 자동 생성

**Monthly**:
1. **내 원장**:
   - 수입: `pickup_fee`, `bonus`
   - 공제: `deduction`, `penalty`
   - Net 확인
2. **Payslip 확인 → Acknowledge**

**제외 사항**:
- 게스트 PII (전화번호, 결제정보) 제한적 접근
- 운영 재무 / 다른 직원 데이터 차단

---

### 4.7 Kitchen / Hall / General Staff

**스코프**: 본인 원장만 (Kitchen·Hall은 POS Order 작성 권한 추가).

**Daily**:
1. (Kitchen·Hall만) POS 주문 처리 / 서빙 상태 업데이트
2. 출퇴근 체크인 / 체크아웃

**Monthly**:
1. **내 원장**:
   - 수입: `base_salary`, `allowance`, `overtime`, `bonus`
   - 공제: `deduction`, `penalty`
   - Net 확인
2. **Payslip 확인 → Acknowledge**

**General 추가 (타임시트 기반 급여)**:
```
base_salary = 근무일수 × 일급
penalty = 지각 분 × 단가
overtime = 초과 근무 시간 × 단가
```

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Kitchen / Hall은 결제 / 환불 권한 없음**: POS 주문 입력만 가능. 결제는 Manager 이상.

---

### 4.8 Investor (투자자)

**스코프**: 투자한 지점들의 **집계 데이터만**. 운영 데이터 완전 차단 (RBAC 403).

**Real-time Monitoring**:
```
[투자자 대시보드]
   ↓
지점별 스냅샷 카드 (지분 보유 지점만):
  - Today Revenue
  - This Month Revenue (누적)
  - Estimated Payout (예상 배당)
  - Occupancy Rate (%)
  - Equity Share (%)
   ↓
수익 차트 (Hourly / Daily 토글):
  - Area Chart + Bar Chart
   ↓
실시간 Activity Feed (Socket.io):
  - "Order #XXX paid — Cash / RM 450.00" (금액만, 게스트 정보 X)
  - "Reservation #XXX checked_in — Room A / 4 guests" (이름 X, 인원만)
```

**Monthly Reports**:
```
[지점별·기간별 선택]
   ↓
수익 분류:
  Room / Beverage / Food / Package / Other / Total
   ↓
수익성 분석:
  Gross Profit / Net Profit / Commission 비용 / 객실 가동률(%)
   ↓
운영 KPI:
  Sessions / Unique Customers / Avg Spend
   ↓
PDF 다운로드 (워터마크 + 다운로드 감사 로그)
```

**절대 제외 사항** (RBAC 403):
- 게스트 PII (이름, 전화번호, ID)
- 호스티스 PII (이름, 사진, 연락처, 개별 커미션)
- 직원 급여 / 원장
- Folio / Invoice 원본
- POS Order 상세
- 다른 지점 데이터 (지분 보유 지점 외)

⚠️ **KARAOKE OPS CONSIDERATION**:
- **투자자가 Excel 추출을 요구해도 raw data 제공 금지**. 항상 `investor_reports` 테이블의 집계값만. 한 번 raw가 새면 영업비밀·개인정보 동시 유출.
- **PDF 워터마크**: 투자자 ID + 다운로드 시각 워터마크 → 외부 유출 추적 가능.

📈 **BUSINESS IMPACT**: 투자자 대시보드의 실시간 활동 피드는 **투자자 신뢰도 + 자본 조달 속도**에 직접 영향.

---

## 5. RBAC Permission Matrix

**약어**: SA=Super Admin · AD=Admin · BM=Branch Manager · MG=Manager · HO=Hostess · DR=Driver · K/H/G=Kitchen/Hall/General · IN=Investor

### 5.1 Folio & POS

| 기능 | SA | AD | BM | MG | HO | DR | K/H/G | IN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Folio 조회 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Folio 항목 추가 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Folio 항목 Void | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Discount 적용 | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| POS 주문 생성 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ |
| POS 결제 처리 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| POS Order Void | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

⚠️ = 매니저 승인 후 가능 / Kitchen·Hall은 주문 입력만

### 5.2 Invoice & Payment

| 기능 | SA | AD | BM | MG | HO | DR | K/H/G | IN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Invoice 조회 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Invoice 발행 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Invoice Void | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Payment 등록 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Refund 처리 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Receipt 발행 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 5.3 Reports

| 기능 | SA | AD | BM | MG | HO | DR | K/H/G | IN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Daily Report | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports > Revenue | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports > Occupancy | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports > Commissions | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports > P&L | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Investor Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Investor Reports (집계) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 5.4 Ledger & Payroll

| 기능 | SA | AD | BM | MG | HO | DR | K/H/G | IN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 전체 Ledger 조회 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 내 원장 조회 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ledger 수동 추가 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ledger Reversal | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Payslip 생성 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Payslip 발행 (issue) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Payslip Acknowledge (자기) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Payout Resolution 승인 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 5.5 Master Data & Investor

| 기능 | SA | AD | BM | MG | HO | DR | K/H/G | IN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Tables/Room 요금 관리 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tax Config | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Shareholder 등록·수정 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Settlement 생성·승인 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 5.6 시스템 운영

| 기능 | SA | AD | BM | MG | HO | DR | K/H/G | IN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Nightly Batch 수동 실행 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ledger Audit 도구 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tenant 관리 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 6. Data Flow Diagrams

### 6.1 Booking → Receipt 전체 흐름

```
[Reservation]
     │
     ↓ check-in
[Folio (open)]
     │
     ├─── [POS Order] ──┬─→ order_items ──→ folio_entries(pos_item)
     │                  └─→ payments (선결제 시)
     │
     ├─── [Hostess Session] ──→ session 종료 ──→ folio_entries(hostess_charge)
     │                                    │
     │                                    └─→ ledger_entries(commission_session)
     │
     ├─── [Pickup Job] ──→ 완료 ──→ folio_entries(pickup_fee?)
     │                          └─→ ledger_entries(pickup_fee, driver)
     │
     └─── [Manual Entry] ──→ folio_entries(outcall/late/discount/other)
     │
     ↓ check-out
[Folio (closed)] ──→ Subtotal + Tax + Service Charge 계산
     │
     ↓
[Invoice (issued)]
     │
     ↓ payment 등록
[payments]
     │
     ↓ amount_paid >= total_amount?
[Invoice (paid)] ──→ [Receipt] ──→ WhatsApp 발송
     │
     ↓
[Daily Report] (즉시 집계)
     │
     ↓ 익일
[Monthly Reports] (집계)
     │
     ↓ 월말
[Investor Reports] (지분율 적용)
     │
     ↓
[Shareholder Settlement]
```

### 6.2 Nightly Batch (Payroll)

```
Trigger: cron @ 00:30 venue_local_time
구현: api-server 내부 cron 모듈 (또는 외부 scheduler가 POST /ledger/batch/run 호출)

For each branch:
  1. ATTENDANCE → ledger_entries
     - base_salary (일급 단위 계산)
     - penalty (지각 분)
     - overtime (초과 근무)

  2. HOSTESS SESSIONS (오늘 종료된)
     → ledger_entries (commission_session)
     - 10분 룰 billed_hours 적용
     - hourly_rate_guest 적용

  3. POS ORDERS (오늘 finalized)
     → 호스티스별 drink commission
     → 호스티스별 package commission
     → 에이전트별 booking commission

  4. PICKUP JOBS (오늘 완료)
     → ledger_entries (pickup_fee, driver)

  5. ADVANCE / DEDUCTION SCHEDULED (오늘 만기)
     → ledger_entries (advance_repayment, deduction)

  6. AGGREGATE for daily_summary table

End of loop → notify Super Admin via Telegram/Email
```

⚠️ **KARAOKE OPS CONSIDERATION**:
- **Idempotency**: 배치가 중복 실행되어도 동일 결과여야 함. `(source_type, source_id, entry_type)` UNIQUE 제약 + Drizzle `onConflictDoNothing()` 패턴.
- **Timezone Awareness**: 말레이시아·태국·싱가포르가 같이 운영 중이면 각 지점 local time 00:30 별도 실행. 단일 cron 금지.

### 6.3 Money 흐름 (회계 관점)

```
[고객 지급]
   │
   ↓
[Cash Drawer / Card Acquirer / Bank Account]
   │
   ↓ Folio 매핑
[Revenue Recognition]
   │
   ├─→ Room Revenue
   ├─→ POS Revenue
   ├─→ Hostess Service Revenue
   └─→ Other Revenue
                 │
                 ↓ 비용 차감
   ┌─────────────┼──────────────┐
   ↓             ↓              ↓
[COGS]    [Commission]    [Operating Expenses]
   │           │                │
   │           ├─→ Hostess (ledger)
   │           ├─→ Agent (ledger)
   │           └─→ Agency (vendor invoice)
   │
   ↓
[Gross Margin] → [Net Profit] → [Shareholder Payout × 지분%]
```

---

## 7. Edge Cases & 도메인 주의사항

### 7.1 Folio / Invoice 관련

1. **Mid-session 결제 분할**: 게스트가 "절반은 지금 카드, 나머지는 떠날 때 현금" 요청 → Invoice 1개에 payment 2개. `partially_paid` 상태에서 계속 folio 누적 가능.
2. **체크아웃 후 추가 청구**: 미니바 사후 발견, 분실/파손 → 별도 `supplemental_invoice`. 기존 Folio 재오픈 절대 금지.
3. **외상 (Corporate Account)**: `customer_type = corporate` + `credit_terms_days`. Invoice는 `issued`, payments는 익월 입금 시. AR 관리 필요.
4. **No-show 처리**: 예약은 있지만 안 옴 → Reservation `status = no_show`, 보증금만 forfeit. Folio는 개설 안 함.
5. **Walk-in Cash Sale**: 예약 없이 입장 → 즉석 reservation 생성 → folio → 결제 동시 처리.
6. **세율 변경 시점**: 세율 변경 후에도 변경 전 issued invoice는 옛 세율 유지. `tax_config_snapshot`으로 박제.
7. **다중 통화 결제**: 외국 게스트가 원/달러로 일부 결제 → `payments.currency`와 `payments.amount_in_invoice_currency` 분리. 환율은 결제 시점 박제.

### 7.2 Hostess / Commission 관련

8. **세션 중 호스티스 교체**: 게스트 요청으로 A → B 교체. 두 호스티스 각각 부분 세션. session_minutes 분할 + 각자 10분 룰 적용.
9. **블랙 게스트 요청**: 게스트가 특정 호스티스를 거부 → 호스티스 swap 시 기존 호스티스 세션 정상 종료 처리 + 새 호스티스 시작.
10. **호스티스 지각**: 출근 지각은 `attendance.late_minutes` → penalty (ledger). 세션 지각(고객 입장 후 늦은 도착)은 `session.late_to_session_minutes` → 세션 시간에서 차감.
11. **Agency 호스티스 정산 충돌**: agency가 invoice 보내옴 / 시스템 commission 계산값과 불일치 → reconciliation 화면에서 manual adjust + reason 기록.
12. **호스티스 "수입 X" 분쟁**: 가장 빈번. UI에 commission breakdown (어느 세션/어느 드링크/얼마) 명확히 표시. 화면 캡처로 분쟁 즉시 종결.

### 7.3 결제 관련

13. **부분 결제 후 게스트 잠적**: Invoice는 `partially_paid` 상태로 영구 보존. AR aging report에서 추적.
14. **카드 결제 chargeback (한참 후)**: 별도 `chargebacks` 테이블. Invoice 상태는 안 건드리고 negative payment + journal entry.
15. **현금 결제 부족 (소수점 버림)**: 거스름돈 부족 → tip으로 처리하거나 round-down 정책. branch policy로 설정.
16. **이중 결제 사고**: 카드 단말기 통신 오류 후 재시도 → 양쪽 다 승인됨. `payment_intent_id` (멱등키)로 중복 방지.

### 7.4 Multi-tenant / Multi-branch 관련

17. **지점간 직원 이동**: 같은 직원이 KL01에서 KL02로 1주일 지원 → `staff_branch_assignments` 기간 기반 + ledger entry는 근무 지점에 귀속.
18. **지점간 게스트 환승**: 한 게스트가 KL01에서 KL02로 옮겨가는 경우 → 별도 reservation 2개. 통합 멤버십 history에서만 연결.
19. **Tenant 분리**: 한 사장이 두 브랜드 운영 (예: KL Karaoke + KL Lounge) → 별도 tenant. RLS로 완전 분리.

### 7.5 Investor 관련

20. **투자자 → 운영 권한 격리**: 투자자가 자기 지점 매출이 낮다고 운영 데이터 요구 → 시스템상 차단. Admin 통해서만 요약 보고.
21. **지분 변경 시점**: 월중 지분 변경 → 해당 월 배당은 "지분 가중평균" or "월말 시점 기준" 정책. tenant policy 설정.
22. **Loss 월의 배당**: 순손실 월에는 settlement 생성 X (or amount=0, status=skipped).

### 7.6 시간 / 통화 관련

23. **자정 걸친 세션**: 23:30 시작 02:00 종료 → 영업일 어디 귀속? 일반적으로 시작일 기준 (`business_date = 시작일`).
24. **Daylight Saving**: 한국·중국·말레이시아·태국·싱가포르 모두 DST 없음 → 무시 OK. 단 향후 확장 대비 `timezone` 컬럼 사용.
25. **환율 갱신**: 외국 게스트 외화 결제 시 환율은 어디서 가져옴? 일일 갱신 (예: 아침 9시 BNM 고시 환율) → `exchange_rates` 테이블. ExchangeRate API 연동 활용.

---

## 8. TypeScript 구현 가이드라인 (Drizzle / Express / Socket.io)

> 이 프로젝트는 pnpm 모노레포 + TypeScript 단일 스택입니다. 별도 마이그레이션(.NET 등) 계획은 현재 없습니다. 아래는 본 코드베이스에서 finance 관련 코드를 작성·수정할 때의 컨벤션입니다.

### 8.1 Drizzle 스키마 컨벤션

- 금액 컬럼은 반드시 `numeric({ precision: 12, scale: 2, mode: 'string' })`.
- `mode: 'string'` 으로 설정하여 JS `number`로의 자동 변환을 차단 → 호출자가 의식적으로 `decimal.js` 또는 정수 변환을 거치도록 강제.
- 모든 거래성 테이블에 `tenantId`, `branchId`, `createdBy`, `createdAt`(`timestamp({ withTimezone: true })`), `updatedAt` 포함.
- Idempotency 보장이 필요한 테이블(`ledger_entries`, `payments`)에는 `unique` 제약: `unique('idx_ledger_idem').on(t.sourceType, t.sourceId, t.entryType)`.
- Soft void 컬럼 세트: `isVoid`, `voidReason`, `voidedBy`, `voidedAt`. `where(eq(t.isVoid, false))` 가 default 쿼리 패턴.

### 8.2 서비스 레이어 패턴

```ts
// artifacts/api-server/src/services/folio.service.ts
export class FolioService {
  constructor(private readonly db: Database, private readonly io: Server) {}

  async addEntry(folioId: string, input: AddEntryInput, actor: AuthUser) {
    return this.db.transaction(async (tx) => {
      // 1. RBAC + tenant/branch scope assertion
      // 2. Folio FOR UPDATE + status open 검증
      // 3. folio_entries INSERT
      // 4. folios.subtotal/total 재계산
      // 5. 감사 로그
      // 6. tx 커밋 후 io.to(`branch:${branchId}`).emit('folio:entry_added', ...)
    });
  }
}
```

- Express 라우트는 thin: Zod 검증 → 서비스 호출 → 응답 직렬화. 비즈니스 로직 금지.
- `io.emit`은 트랜잭션 **커밋 이후**에만. 롤백 시 잘못된 이벤트 방지.

### 8.3 Zod 검증

- Orval이 OpenAPI에서 자동 생성한 Zod 스키마를 1차 게이트로 사용.
- 도메인 불변식(예: `discount.amount < 0`, `payment.amount > 0`)은 Zod `refine`으로 추가.
- 모든 핸들러는 `validateRequest({ body, params, query })` 미들웨어 통과 후 진입.

### 8.4 Socket.io 이벤트 카탈로그

| 이벤트 | 페이로드 | 룸 |
|---|---|---|
| `room:status_changed` | `{ roomId, status, reservationId? }` | `branch:{branchId}` |
| `folio:entry_added` | `{ folioId, entry }` | `branch:{branchId}` |
| `folio:entry_voided` | `{ folioId, entryId, reason }` | `branch:{branchId}` |
| `invoice:status_changed` | `{ invoiceId, status, balanceDue }` | `branch:{branchId}` |
| `payment:received` | `{ paymentId, invoiceId, method, amount, currency }` | `branch:{branchId}` |
| `receipt:generated` | `{ receiptNo, invoiceId, pdfUrl }` | `branch:{branchId}` |
| `investor:activity_feed` | `{ branchId, kind, maskedPayload }` | `investor:{shareholderId}` |

⚠️ Investor 룸으로는 **마스킹된** 페이로드만 emit. Branch 룸 이벤트와 투자자 룸 이벤트는 별도 함수로 분리.

### 8.5 RBAC / 멀티테넌시

- 미들웨어 체인: `requireAuth → loadTenantContext → requireRole(['BRANCH_MANAGER',...]) → requireBranchAccess → autoAudit`.
- 모든 Drizzle 쿼리에 `eq(t.tenantId, ctx.tenantId)` + `inArray(t.branchId, ctx.allowedBranchIds)`. PostgreSQL RLS도 병행 권장 (`SET LOCAL app.tenant_id`).
- Investor 응답은 별도 DTO로 변환(필드 마스킹 + 화이트리스트). 도메인 객체 그대로 반환 금지.

### 8.6 테스트 / 검증 우선순위

1. `calculateBilledHours` 단위 테스트 (10분 룰 경계값)
2. Payment 동시성 테스트 (`SELECT ... FOR UPDATE` 잠금 검증)
3. Nightly batch idempotency (2회 실행 후 결과 동일)
4. RBAC 누출 테스트 (다른 tenant/branch 데이터 200 OK 나면 즉시 fail)
5. Tax config snapshot — 세율 변경 후 과거 invoice 재조회 시 옛 세율 유지

### 8.7 Money 산술 가이드

```ts
import Decimal from 'decimal.js';

// ❌ 금지
const total = Number(subtotal) + Number(tax);

// ✅ 권장
const total = new Decimal(subtotal).plus(tax).toFixed(2);
```

또는 정수 cent 변환 후 산술. 하나의 컨벤션을 모듈 단위로 통일.

---

## 9. Glossary & Status Codes

### 9.1 용어집

| 용어 | 정의 |
|---|---|
| **Folio** | 한 예약의 청구 항목 누적 장부 (체크인 ~ 체크아웃) |
| **Invoice** | 공식 청구서 (Folio finalize 후 발행) |
| **Receipt** | 영수증 (전액 결제 시 자동 발행) |
| **Ledger Entry** | 직원 개인 원장 한 줄 (수입 또는 공제) |
| **Payslip** | 월간 급여명세서 (ledger entries 집계) |
| **Payout Resolution** | 급여 실지급 결재 |
| **Settlement** | 주주 배당 결재 (월간) |
| **Nightly Batch** | 매일 자정 30분 후 실행되는 ledger entry 자동 생성 작업 |
| **10분 룰** | 호스티스 세션 시간 청구 시 잔여분 < 10min 절사 / >= 10min 올림 |
| **Idempotency Key** | 중복 실행 방지 고유 키 (`source_type` + `source_id` + `entry_type`) |
| **Soft Void** | 삭제 대신 `is_void=true` 플래그 처리 |
| **Reversal** | 잘못된 ledger entry의 반대방향 entry 생성으로 상쇄 |

### 9.2 상태 코드 정리

**Reservation**: `inquiry → tentative → confirmed → seated → extended → checked_out → closed` ( `cancelled` / `no_show` 분기 )

**Folio**: `open → closed → voided`

**Invoice**: `draft → issued → partially_paid → paid` ( `void` 분기 )

**POS Order**: `open → finalized → settled` ( `voided` 분기 )

**Payslip**: `draft → issued → acknowledged → paid`

**Shareholder Settlement**: `draft → pending → approved → paid` ( `cancelled` 분기 )

**Ledger Entry**: `pending → posted → reversed`

---

## 📌 부록 A: 자주 발생하는 버그 패턴 (Claude Code 디버깅 가이드)

| 증상 | 자주 있는 원인 | 점검 포인트 |
|---|---|---|
| Folio total과 Invoice total 불일치 | void된 entry 합산 누락 / discount 부호 오류 | `is_void=false` 필터 + discount는 음수 amount로 통일 |
| 호스티스 커미션이 0 | session_minutes 계산 오류 / 10분 룰 미적용 | `calculateBilledHours()` 단위 테스트 |
| Daily Report 매출과 Payment 합계 불일치 | 외상 / 분할결제 / 환불 미반영 | 두 지표는 다름이 정상. 별도 표시 |
| 야간 배치 실행 후 ledger 중복 | UNIQUE 제약 누락 / idempotency key 미사용 | `(source_type, source_id, entry_type)` UNIQUE 확인 |
| 투자자 화면에 게스트 이름 노출 | RBAC/DTO 마스킹 누락 | `investor_reports` view 또는 마스킹 DTO 경로만 사용 |
| 세율 변경 후 과거 invoice가 새 세율로 보임 | tax_config snapshot 미저장 | 발행 시점 `tax_config_snapshot` jsonb 저장 |
| 다른 지점 매출 보임 | branch_id WHERE 절 누락 | RLS + Drizzle 쿼리 필터 둘 다 확인 |
| 금액 합계가 소수점에서 1원씩 어긋남 | `Number` 산술 사용 | `decimal.js` 또는 정수 cent로 변환 |

---

## 📌 부록 B: KPI 계산식 모음

```sql
-- Revenue per Room per Hour (RevPRH, 호텔의 RevPAR 등가)
SELECT
  branch_id,
  SUM(amount) FILTER (WHERE entry_type IN ('room_charge','pos_item','hostess_charge'))
    / NULLIF(COUNT(DISTINCT room_id) * EXTRACT(EPOCH FROM (close - open))/3600, 0) AS rev_prh
FROM folio_entries fe
JOIN folios f ON fe.folio_id = f.id
WHERE NOT is_void AND business_date = :date
GROUP BY branch_id;

-- Hostess Utilization Rate
SELECT
  hostess_id,
  SUM(billed_minutes) / NULLIF(SUM(available_minutes), 0) * 100 AS utilization_pct
FROM (
  SELECT s.hostess_id, SUM(s.billed_minutes) AS billed_minutes,
         (SELECT SUM(EXTRACT(EPOCH FROM (shift_end - shift_start))/60)
          FROM shifts WHERE staff_id = s.hostess_id AND date BETWEEN :from AND :to) AS available_minutes
  FROM hostess_sessions s
  WHERE s.business_date BETWEEN :from AND :to
  GROUP BY s.hostess_id
) x
GROUP BY hostess_id;

-- F&B Attach Rate
SELECT
  COUNT(DISTINCT f.id) FILTER (WHERE EXISTS (
    SELECT 1 FROM folio_entries WHERE folio_id = f.id AND entry_type = 'pos_item' AND NOT is_void
  ))::numeric / NULLIF(COUNT(DISTINCT f.id), 0) * 100 AS fnb_attach_rate
FROM folios f
WHERE f.opened_at::date BETWEEN :from AND :to;

-- No-show Rate
SELECT
  COUNT(*) FILTER (WHERE status = 'no_show')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE booking_type = 'advance'), 0) * 100 AS no_show_rate
FROM reservations
WHERE booking_date BETWEEN :from AND :to;
```

---

*문서 끝.*
*KL Project — Multinational Karaoke Business Management & Reservation System*
*v2.0 — TypeScript / Drizzle / Express 5 / Socket.io 기준*

---

⚠️ **KARAOKE OPS CONSIDERATION**: 이 문서는 Claude Code가 **혼자서 reasoning** 할 때 잘못된 가정을 하지 않도록 설계되었습니다. 특히 다음 함정들을 명시:
- "삭제 = soft void, 절대 DELETE 아님"
- "Hostess Service Revenue ≠ Hostess Commission Cost"
- "Revenue ≠ Payments (외상/분할 때문)"
- "Tax는 발행 시점 snapshot, 현재 세율 X"
- "금액 산술은 `decimal.js` 또는 정수 cent, `Number` 금지"
