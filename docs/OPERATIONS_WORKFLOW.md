# KL Project — Operations Workflow Specification

> **Purpose**: 각 역할(role)이 출근부터 퇴근까지 무엇을, 어떤 화면에서, 어떤 순서로, 어떤 트리거에 의해 수행하는지 정의한다.
> **Audience**: Claude Code agent, 개발자, QA, 점주
> **Stack**: Node.js + Express + PostgreSQL + Socket.io (Replit MVP) → C# .NET 8 + React 18 + SignalR (Production)
> **Version**: 2.0 · **Last Updated**: 2026-03-20

---

## 0. Claude Code 사용 가이드

이 문서를 받은 Claude Code는 작업 시 다음 순서로 참고한다:

1. **§1 시스템 오버뷰** — 전체 액터와 핸드오프 흐름을 먼저 이해
2. **§2 매장 하루 라이프사이클** — 시간 축 위에서 어떤 이벤트가 발생하는지 파악
3. **§3~§13 역할별 워크플로우** — 작업이 영향을 주는 역할의 워크플로우를 확인
4. **§14 역할 간 핸드오프 매트릭스** — 한 역할의 변경이 다른 역할에 미치는 영향 점검
5. **§15 권한 매트릭스** — RBAC 검증
6. **§16 구현 체크리스트** — 코드 변경 전 self-check

**Add Only Rule**: 기존 라우트, 컴포넌트, 권한 엔트리는 **절대 삭제하지 않는다**. 항상 추가 또는 feature flag로 확장.

---

## 1. 시스템 오버뷰

### 1.1 액터 구성

```
┌───────────────────────────────────────────────────────────────┐
│                  KL Karaoke Platform                          │
│                                                               │
│  ┌─────────── STAFF PORTAL (다크 테마) ───────────┐           │
│  │                                                │           │
│  │  운영 계층:  SUPER_ADMIN → ADMIN → BM → MG    │           │
│  │  현장 계층:  HOSTESS · DRIVER · KITCHEN ·     │           │
│  │            HALL · GENERAL                      │           │
│  │  외부 계층:  INVESTOR (운영 데이터 차단)       │           │
│  │                                                │           │
│  └────────────────────────────────────────────────┘           │
│                                                               │
│  ┌─────────── CUSTOMER PORTAL (라이트 테마) ─────┐           │
│  │  CUSTOMER (전화/이메일 별도 인증)              │           │
│  └────────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────────┘
```

- **스태프 역할 10개**: SUPER_ADMIN, ADMIN, BRANCH_MANAGER, MANAGER, INVESTOR, HOSTESS, DRIVER, KITCHEN, HALL, GENERAL
- **고객 포털 1개**: CUSTOMER (별도 인증 시스템, `/customer/*` 격리 서브트리)
- **공통 페이지**: `/my-profile` (전 역할), `/my-ledger` (INVESTOR 제외)

### 1.2 핵심 개념

| 개념 | 정의 |
|---|---|
| **세션 (Session)** | 한 예약이 룸을 점유하는 시간 단위 (체크인 → 체크아웃) |
| **폴리오 (Folio)** | 한 세션에 매달린 운영 중인 청구서 |
| **호스티스 세션 (Hostess Session)** | 호스티스가 룸 세션에 배정된 시간 단위 (커미션 산정 단위) |
| **에이전시 호스티스** | 외부 에이전트가 공급한 호스티스 (직고용과 정산 분리) |
| **투자자 보고서 (Investor Report)** | 야간 집계 작업으로 생성된 PII 제거 집계본 |

### 1.3 실시간 채널

| Socket.io Namespace | 사용 화면 | 이벤트 예시 |
|---|---|---|
| `/room-board` | 룸 보드 | `room.status.changed`, `session.extended` |
| `/pos` | POS, 주방, 홀 | `order.created`, `order.status.changed` |
| `/manager` | 매니저 대시보드 | `session.alert`, `last-call.due` |
| `/investor` | 투자자 대시보드 | `revenue.tick` (익명화) |

---

## 2. 매장 하루 라이프사이클

> 모든 역할의 워크플로우는 이 시간 축 위에서 동작한다.

```
06:00 ─┬─ 야간 집계 작업 완료 (raw → investor_reports)
       │  ↓
17:00 ─┼─ Branch Manager 출근 → 어제 일일보고서 검토
       │  ↓
17:30 ─┼─ Manager + Hostess + Kitchen + Hall + Driver 출근
       │  → 클락인 → 사전 브리핑 → 룸 보드 점검
       │  ↓
18:00 ─┼─ 영업 시작 (룸 보드 Available → Reserved/Occupied)
       │  ↓
20:00 ─┼─ 워크인 + 사전 예약 체크인 시작
       │  ↓
21:00 ─┼─ 피크 진입 — Manager 대시보드 30초 갱신 풀가동
       │  ↓
22:00 ─┼─ 호스티스 세션 + F&B 주문 폭주 → POS, Kitchen, Hall 동시 가동
       │  ↓
01:00 ─┼─ 라스트콜 알림 (last-call.due 이벤트 → 홀 스태프 액션)
       │  ↓
02:00 ─┼─ 체크아웃 + 폴리오 결제 + 호스티스 세션 종료
       │  ↓
03:00 ─┼─ Manager 일일보고서 마감 → Branch Manager 검수 → 클락아웃
       │  ↓
03:30 ─┼─ 청소/리셋 → 룸 상태 Cleaning → Available
       │  ↓
04:00 ─┴─ 매장 마감 → 야간 집계 작업 트리거
```

---

## 3. SUPER_ADMIN 워크플로우

### 3.1 책임 범위
플랫폼 최고 관리자. 모든 지점, 모든 메뉴 접근. 유일하게 사용자 계정 생성 권한 보유.

### 3.2 일상 워크플로우

```
[로그인] → /dashboard (전 지점 탭)
    ↓
[모니터링] 지점별 매출·점유율·예약 수 일괄 확인
    ↓
[이슈 발생 감지]
    ├─ 특정 지점 매출 이상 → 해당 지점 탭 클릭 → 룸 보드 + 매니저 대시보드 점검
    ├─ 신규 직원 채용 요청 → /settings/users → 계정 생성 → 역할 + 지점 배정
    ├─ 신규 지점 오픈 → /settings/branches → 지점 등록 → 메뉴/세금 설정
    └─ 시스템 설정 변경 → /settings/menu → 사이드바 카테고리 조정
    ↓
[보고서 검토] /investor-reports로 투자자 시각 점검 (집계 정상 여부)
    ↓
[로그아웃]
```

### 3.3 주요 액션 카탈로그

| 액션 | 라우트 | 트리거 |
|---|---|---|
| 사용자 계정 생성 | `POST /api/v1/users` | 매뉴얼 (HR 요청 접수) |
| 지점 등록 | `POST /api/v1/branches` | 신규 지점 계약 체결 |
| 사이드바 메뉴 토글 | `PATCH /api/v1/settings/menu` | 기능 출시/철회 |
| 전 지점 KPI 비교 | `GET /api/v1/reports/cross-branch` | 매뉴얼 |
| RBAC 위반 로그 검토 | `GET /api/v1/audit-log?action=RBAC_VIOLATION` | 정기 (주 1회) |

> ⚠️ **KARAOKE OPS CONSIDERATION**: SUPER_ADMIN 계정은 2FA 필수. 가라오케 업계는 영업시간이 새벽이라 도난·해킹 시 야간에 발견되지 않을 위험이 큼. 의심 로그인 시 자동 잠금 + WhatsApp 알림.

---

## 4. ADMIN 워크플로우

### 4.1 책임 범위
체인 오너 또는 본사 운영팀. 전 지점 통합 관리. 사용자 계정 생성 불가 (SUPER_ADMIN에 요청).

### 4.2 일상 워크플로우

```
[로그인] → /dashboard (전 지점 탭)
    ↓
[아침 루틴 — 09:00~10:00]
  ├─ /reports로 어제 전 지점 매출 합산 확인
  ├─ /investor-dashboard로 주주 시각 점검
  └─ /daily-report에서 지점별 결제 집계 검증
    ↓
[운영 액션]
  ├─ 메뉴 가격 변경 → /products → 전 지점 일괄 또는 지점 선택 적용
  ├─ 호스티스 에이전시 계약 갱신 → /agencies → 에이전트 정보 업데이트
  ├─ 신규 지점 메뉴 셋업 → /settings/menu → 카테고리 복사
  └─ 호스티스 마스터 데이터 정정 → /hostess
    ↓
[저녁 루틴 — 22:00 전후]
  └─ Manager 대시보드를 지점별로 순회 점검
    ↓
[로그아웃]
```

### 4.3 주요 액션 카탈로그

| 액션 | 라우트 | 트리거 |
|---|---|---|
| 다지점 메뉴 일괄 업데이트 | `PUT /api/v1/products/bulk` | 가격/상품 정책 변경 |
| 에이전시 계약 등록 | `POST /api/v1/agencies` | 신규 에이전시 온보딩 |
| 통합 P&L 조회 | `GET /api/v1/reports/consolidated-pnl` | 월말/분기말 |
| 주주 명부 갱신 | `PATCH /api/v1/shareholders` | 지분 양도/추가 투자 |

> 💡 **INDUSTRY INSIGHT**: 가라오케 체인은 메뉴/가격이 지점마다 미묘하게 다르다 (지역 임대료/소득 수준 반영). 일괄 업데이트 시 항상 **지점 선택 UI**를 보여주고, "전 지점" 선택은 confirm 다이얼로그 필수.

---

## 5. BRANCH_MANAGER 워크플로우

### 5.1 책임 범위
담당 지점의 P&L 책임자. 단일 지점 데이터만 보임 (`branch_id` 자동 필터).

### 5.2 일상 워크플로우 (시간 축 기반)

```
17:00 [출근/클락인] → /attendance → Clock In
    ↓
17:10 [전일 결산 검토] → /daily-report?date=yesterday
    ├─ 매출 합계 확인
    ├─ 결제 수단별 합계 (현금 vs 카드 vs e-wallet)
    └─ 이상 거래 (큰 환불, 매니저 컴프) 감사
    ↓
17:30 [당일 준비] → /dashboards/branch-manager
    ├─ 오늘 예약 수 확인
    ├─ 룸 상태 그리드 점검 (전 룸 Available?)
    ├─ 직원 출근 현황 — 누가 안 왔는지 파악
    └─ 호스티스 가용 인원 확인
    ↓
18:00 [영업 시작 모니터링] → /room-board (Socket.io 라이브)
    ↓
18:00~02:00 [실시간 운영]
    ├─ 룸 점유율 변화 실시간 추적
    ├─ /reservations로 워크인 입력 (전화 예약 처리)
    ├─ /pos에서 결제 분쟁 발생 시 매니저 권한으로 컴프/할인 승인
    ├─ 호스티스 지각 발생 시 /attendance에서 패널티 등록
    └─ Manager 대시보드 sub-monitor로 띄워두고 알림 수신
    ↓
03:00 [마감 결산] → /daily-report?date=today
    ├─ 매출/결제 합계 확정
    ├─ 캐시 드로어 정산 (실물 vs 시스템)
    └─ Manager가 작성한 야간 보고서 승인
    ↓
03:30 [클락아웃] → /attendance → Clock Out
```

### 5.3 주요 액션 카탈로그

| 액션 | 라우트 | 트리거 | 영향 |
|---|---|---|---|
| 워크인 예약 생성 | `POST /api/v1/reservations` | 전화/방문 | 룸 보드 즉시 갱신 (Socket.io) |
| 매니저 컴프 승인 | `PATCH /api/v1/folios/:id/comp` | POS에서 직원이 요청 | audit_log 필수, 사유 입력 |
| 호스티스 지각 패널티 | `POST /api/v1/attendance/penalty` | 시프트 시작 후 직원 미클락인 | 커미션 차감 연동 |
| 룸 상태 강제 변경 | `PATCH /api/v1/rooms/:id/status` | 장비 고장 등 | Out-of-Order 처리 |
| 일일보고서 승인 | `POST /api/v1/daily-reports/:id/approve` | Manager 작성 완료 후 | 본사로 전송 |

### 5.4 알림 (실시간 푸시)

- 호스티스 미출근 (시프트 시작 +15분)
- F&B 라스트콜 누락 룸
- 캐시 드로어 임계치 초과
- 분쟁 폴리오 발생

> ⚠️ **KARAOKE OPS CONSIDERATION**: 가라오케에서 가장 흔한 분쟁은 "호스티스 시간 카운트"다. Branch Manager는 분쟁 발생 시 즉시 `/hostess/sessions/:id`로 가서 시작/종료 시각, 룸 CCTV 링크(추후 통합), 호스티스 클락인 기록을 한 화면에서 비교할 수 있어야 함. 별도 화면 이동 없이 한 페이지에 모이는 UX가 중요.

---

## 6. MANAGER 워크플로우

### 6.1 책임 범위
플로어 운영 총괄. 실시간 모니터링 중심. 지점 설정 권한 없음.

### 6.2 일상 워크플로우

```
17:30 [클락인] → /attendance
    ↓
17:45 [사전 브리핑] → /dashboards/manager
    ├─ 오늘 예약 리스트 확인 (VIP 표시 체크)
    ├─ 호스티스 배정표 점검 — 단골 매칭 확인
    └─ 주방/홀 인원 확인
    ↓
18:00~02:00 [실시간 운영 — 30초 자동 갱신]
    │
    ├─ /room-board에서 룸 점유 상황 모니터링
    │
    ├─ /pos 주문 흐름 감시
    │   └─ 경과 시간 너무 긴 주문 → Kitchen에 알림
    │
    ├─ 호스티스 세션 모니터링
    │   ├─ 미배정 룸 발견 → /hostess에서 즉시 배정
    │   └─ 세션 연장 요청 → 다음 예약과 충돌 검사 후 승인
    │
    ├─ Sub-역할 대시보드 순회
    │   ├─ /dashboards/kitchen — 주문 적체 확인
    │   ├─ /dashboards/hall — 고우선순위 태스크 확인
    │   └─ /dashboards/driver — VIP 픽업 진행 상황
    │
    └─ 워크인 처리 → /reservations로 즉석 예약 생성
    ↓
03:00 [마감 정리]
    ├─ 미체크아웃 룸 정리
    ├─ 일일보고서 작성 → Branch Manager에게 제출
    └─ 호스티스 세션 마감 일괄 처리
    ↓
03:30 [클락아웃]
```

### 6.3 매니저 대시보드 핵심 위젯

| 위젯 | 데이터 소스 | 갱신 주기 |
|---|---|---|
| 활성 주문 카드 (객실·경과시간) | `GET /api/v1/orders?status=active` | 30초 |
| 호스티스 세션 현황 | `GET /api/v1/hostess-sessions?status=active` | 30초 |
| 미배정 룸 알림 | Socket.io `room.unassigned` | 실시간 |
| 라스트콜 임박 룸 | Socket.io `last-call.due` | 실시간 |
| 분쟁 폴리오 알림 | Socket.io `folio.disputed` | 실시간 |

> 📈 **BUSINESS IMPACT**: 매니저가 30초마다 화면 새로고침으로 시간 낭비하면 그 시간만큼 분쟁/이슈 대응이 늦어진다. 30초 자동 갱신은 단순 편의가 아니라 **분쟁 발생 → 대응 시간 단축**으로 직결되는 KPI 영향 기능.

---

## 7. INVESTOR 워크플로우

### 7.1 책임 범위
투자 지점의 재무 현황 조회만 가능. 운영 라우트 22개 전체 차단.

### 7.2 일상 워크플로우

```
[로그인] → /investor-dashboard (자동 리다이렉트)
    ↓
[조회 1: 스냅샷]
  ├─ 투자 지점별 카드 — 오늘 매출, 이번 달 매출, 예상 수익, 점유율, 본인 지분율
  ├─ Socket.io 실시간 활동 피드 (익명화 — "Room A 체크인" 형태, 게스트명 X)
  └─ 기간별 수익 Bar/Area 차트 (최근 30일)
    ↓
[조회 2: 월간 보고서] → /investor-reports
  ├─ 지점 선택 → 월 선택
  ├─ 객실 수익 / F&B 수익 / 패키지 수익 분류
  ├─ 커미션 / 순이익
  └─ 고객 수 / 평균 지출
    ↓
[PDF 다운로드] → 워터마크 + audit_log 기록 자동 발생
    ↓
[로그아웃]
```

### 7.3 차단되는 데이터 (절대 노출 금지)

```
❌ 게스트명, 연락처, 회사명
❌ 호스티스명, 사진, 연락처, 시간당 단가
❌ 직원명, 급여 상세
❌ 룸 단위 raw 매출 (집계만 허용)
❌ 결제 수단별 raw 거래 (집계만 허용)
❌ 폴리오 라인 아이템 (집계만 허용)
❌ CCTV 이미지/링크
❌ WhatsApp 통신 내역
```

### 7.4 백엔드 가드

```typescript
// server/middleware/investor-guard.ts
// MIGRATION: convert to .NET [Authorize(Policy="InvestorReadOnly")]

const OPERATIONAL_ROUTES = [
  '/dashboard', '/room-board', '/reservations', '/pos', '/products',
  '/staff', '/hostess', '/agencies', '/schedule-builder', '/attendance',
  '/invoices', '/table-classes', '/daily-report', '/reports',
  '/settings/branches', '/settings/menu', '/settings/users',
  '/dashboards/branch-manager', '/dashboards/manager',
  '/dashboards/hostess', '/dashboards/driver',
  '/dashboards/kitchen', '/dashboards/hall',
];

export function investorGuard(req, res, next) {
  if (req.user.role === 'INVESTOR' && OPERATIONAL_ROUTES.some(r => req.path.startsWith(r))) {
    audit.log({
      user_id: req.user.id,
      action: 'RBAC_VIOLATION',
      attempted_route: req.path,
      timestamp: new Date(),
    });
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

> ⚠️ **CRITICAL**: 한 번이라도 INVESTOR가 운영 데이터(특히 게스트/호스티스 PII)에 노출되면 신뢰 회복이 거의 불가능하다. 22개 라우트 전체 403 + audit 로그가 단순 RBAC가 아니라 **컴플라이언스 게이트** 임을 인지해야 함.

---

## 8. HOSTESS 워크플로우

### 8.1 책임 범위
본인 세션, 본인 커미션, 본인 출근만 조회. 다른 호스티스 데이터 접근 불가.

### 8.2 일상 워크플로우

```
17:30 [출근/클락인] → /my-profile에서 본인 확인 → 클락인 버튼
    ↓
17:45 [오늘 일정 확인] → /dashboards/hostess
    ├─ 오늘 배정된 예약 카드 목록
    │   - 룸 번호 / 시간 / 게스트명(마스킹) / 시간당 단가
    └─ 출근 상태 표시
    ↓
세션마다 반복:
    │
    ├─ [세션 시작] 게스트 도착 → 룸 입장 → 카드의 [체크인] 버튼
    │   → hostess_session.start_time 기록
    │
    ├─ [세션 진행] (가시 데이터 없음 — 시스템상 진행 중)
    │
    └─ [세션 종료] 게스트 체크아웃 → 카드의 [체크아웃] 버튼
        → hostess_session.end_time 기록
        → 매니저 검토 큐로 이동
    ↓
[월말 또는 일별 정산 확인] → /my-ledger
    ├─ 이번 달 커미션 누적 (시간 × 단가)
    ├─ F&B 커미션 (병/패키지)
    ├─ 지각 공제
    └─ 실수령 예상액
    ↓
02:00 [클락아웃]
```

### 8.3 화면별 제약

| 화면 | 보임 | 안 보임 |
|---|---|---|
| `/dashboards/hostess` | 본인 세션, 본인 커미션 | 다른 호스티스 정보 |
| `/my-ledger` | 본인 입출금 | 단가 산정 공식 (정책 정보) |
| `/my-profile` | 본인 정보 편집 | 역할 변경, 지점 변경 (Manager+ 전용) |

### 8.4 커미션 계산 시점 (중요)

```
세션 종료 시점 → 즉시 커미션 표시 (X)
세션 종료 + F&B 폴리오 확정 + 매니저 검토 완료 → 커미션 표시 (O)
```

> ⚠️ **KARAOKE OPS CONSIDERATION**: 호스티스가 체크아웃 직후 커미션을 보면 "F&B 커미션이 왜 0이지?"로 분쟁 시작. **반드시 폴리오 확정 후 표시**, 그 전엔 "정산 대기 중" 상태 노출.

> 🏗️ **MIGRATION NOTE**: 커미션 엔진은 야간 배치(Node) → Hangfire 스케줄러(.NET)로 이관 예정. 현재 코드에 `// MIGRATION: Hangfire job` 주석 필수.

---

## 9. DRIVER 워크플로우

### 9.1 책임 범위
픽업 잡 수행. 지점 데이터 접근 불가, 픽업/복귀 주소와 게스트 이름만 봄.

### 9.2 일상 워크플로우

```
[출근] → 클락인
    ↓
[오늘 일정] → /dashboards/driver
    └─ 잡 카드 목록 (예정·이동중·도착·완료·이슈)
        - 픽업 시간
        - 픽업 주소
        - 복귀 주소 (보통 매장)
        - 게스트 이름 (성만, ex: "Kim 님")
    ↓
잡마다 반복:
    │
    ├─ [수락] [Scheduled → En Route] 버튼 → 출발 시각 기록
    │
    ├─ [도착] [En Route → Arrived] 버튼 → 도착 시각 기록
    │
    ├─ [완료] 게스트 매장 도착 → [Arrived → Completed]
    │
    └─ [이슈] 노쇼/연락두절 → [Issue] 버튼 + 사유 입력
        → Branch Manager 대시보드에 알림 푸시
    ↓
[KPI 확인] 오늘 총 잡 수, 완료 수
    ↓
[클락아웃] → /my-ledger로 일당 확인
```

### 9.3 데이터 가시성

| 항목 | 보임 | 비고 |
|---|---|---|
| 게스트명 | 성만 (Kim 님) | 풀네임 차단 |
| 게스트 연락처 | ❌ | 매장 콜센터 경유 |
| 룸 번호 | ❌ | 픽업과 무관 |
| 매출 정보 | ❌ | |

> 💡 **INDUSTRY INSIGHT**: VIP 게스트는 도어 픽업 + 별도 입구 진입을 선호. 드라이버 카드에 `vip: true`와 `entrance: side_door` 같은 메타데이터 표시 필요. 현재 MVP에서는 `notes` 필드로 처리, 후일 enum 분리.

---

## 10. KITCHEN 워크플로우

### 10.1 책임 범위
주방 주문 파이프라인. 주문 상태 전환만 가능.

### 10.2 일상 워크플로우

```
[클락인]
    ↓
[주문 모니터] → /dashboards/kitchen
    ├─ KPI: 대기 / 조리중 / 완성 카운트
    └─ 주문 카드 목록 (객실·예약#·경과시간)
    ↓
주문마다 (Socket.io 푸시):
    │
    ├─ 신규 주문 도착 (`order.created` 이벤트)
    │   → 카드 자동 추가 + 알림음
    │
    ├─ [Pending → Cooking] 버튼 → 조리 시작 시각 기록
    │
    ├─ [Cooking → Ready] 버튼 → 완성 시각 기록
    │   → 홀 스태프 대시보드에 자동 푸시
    │
    └─ [Ready → Completed] 홀이 픽업 후 처리
        (또는 홀에서 처리해도 무방)
    ↓
[클락아웃]
```

### 10.3 상태 전이도

```
   ┌────────┐    [Cook]    ┌─────────┐    [Ready]    ┌───────┐    [Pickup]    ┌──────────┐
   │ Pending│─────────────▶│ Cooking │──────────────▶│ Ready │───────────────▶│Completed │
   └────────┘              └─────────┘               └───────┘                └──────────┘
                                │                         ▲
                                │      [Cancel]            │
                                ▼                         │
                          ┌──────────┐                    │
                          │Cancelled │                    │
                          └──────────┘                    │
                                                          │
                          (홀이 직접 Completed로 전이 가능)
```

> ⚠️ **KARAOKE OPS CONSIDERATION**: 가라오케 주방은 야간 피크에 동시 조리가 많음. **카드 정렬은 항상 "경과 시간 desc"** (가장 오래된 게 위). 신규 주문이 위로 올라오는 시간순 정렬은 위험.

---

## 11. HALL 워크플로우

### 11.1 책임 범위
홀 서비스 태스크. 룸 단위 서비스 요청 처리.

### 11.2 일상 워크플로우

```
[클락인]
    ↓
[태스크 모니터] → /dashboards/hall
    ├─ KPI: 미완료 / 완료 / 고우선순위 수
    └─ 태스크 카드 (객실·우선순위 색·내용)
        - 🔴 빨강: 긴급 (장비 고장, VIP 요청)
        - 🔵 파랑: 일반 (음료 추가, 마이크 교체)
        - ⚪ 회색: 낮음 (휴지 보충 등)
    ↓
태스크마다 (Socket.io 푸시):
    │
    ├─ 신규 태스크 도착 (`task.created`)
    │
    ├─ [수행]
    │
    └─ [완료 체크] 버튼 → 완료 시각 기록
    ↓
[주방 픽업 알림 수신]
    └─ Kitchen이 Ready로 전환 → Hall 대시보드 푸시
        → Hall이 룸으로 서빙 → [Completed] 처리
    ↓
[클락아웃]
```

### 11.3 우선순위 자동 결정 로직

```typescript
// MIGRATION: extract to .NET MediatR pipeline behavior

function determinePriority(task: Task): 'high' | 'medium' | 'low' {
  if (task.type === 'EQUIPMENT_FAILURE') return 'high';
  if (task.room.guestTier === 'VVIP' || task.room.guestTier === 'PLATINUM') return 'high';
  if (task.type === 'FOOD_SERVE' || task.type === 'BEVERAGE_REFILL') return 'medium';
  return 'low';
}
```

---

## 12. GENERAL 워크플로우

### 12.1 책임 범위
일반 직원 (보안, 청소, 발렛 등). 본인 타임시트와 급여만 조회.

### 12.2 일상 워크플로우

```
[클락인] → 위치 검증 (지점 GPS 반경 내)
    ↓
[근무]
    ↓
[휴게] → /dashboards/general에서 휴게 시작/종료
    ↓
[근무]
    ↓
[클락아웃] → 위치 검증
    ↓
[월말] /my-ledger
    ├─ 이번 달 출근일
    ├─ 총 근무시간
    ├─ 총 급여 (시급 × 시간 - 공제)
    └─ 평균 출근 시각 (지각 패턴 자가 점검)
```

### 12.3 타임시트 항목

| 컬럼 | 의미 |
|---|---|
| 날짜 | 근무일 |
| 출근 | Clock-in 시각 |
| 퇴근 | Clock-out 시각 |
| 지각분 | 시프트 시작 - 출근 시각 (양수만) |
| 패널티 | 지각/조퇴/무단 결근에 따른 차감액 |
| 근무시간 | 출근→퇴근 - 휴게시간 |

---

## 13. CUSTOMER 포털 워크플로우

### 13.1 별도 인증 시스템

```
/customer/login (전화번호 OR 이메일)
    ↓
별도 JWT (CUSTOMER_JWT_SECRET) ─── 스태프 JWT와 완전 분리
    ↓
별도 audit log 테이블 (customer_audit_log)
```

### 13.2 일상 워크플로우

```
[로그인] → /customer
    ↓
[대시보드]
  ├─ 예정 예약 (tentative · confirmed · checked_in) 상단
  └─ 과거 예약 (checked_out · cancelled) 하단
    ↓
[신규 예약] → /customer/booking
  ├─ 지점 선택
  ├─ 날짜 선택
  ├─ 시간 선택 (실시간 가용 슬롯)
  └─ 인원 입력 → [예약]
    ↓
[확인 알림] WhatsApp 자동 전송
    ↓
[방문 후]
  └─ /customer/history에서 영수증 PDF 다운로드 가능
```

### 13.3 UI 테마 분리

```css
/* 스태프 포털: 다크 테마 */
/* 고객 포털: 밝은 테마 — bg-gradient-to-br from-amber-50 to-orange-50 */
```

> ⚠️ **CRITICAL**: 고객 포털과 스태프 포털은 **JWT 시크릿, 쿠키 도메인, 세션 스토리지가 모두 분리**되어야 함. 한쪽 토큰이 다른 쪽에서 검증되면 안 됨.

---

## 14. 역할 간 핸드오프 매트릭스

### 14.1 예약 → 체크아웃 흐름

```
CUSTOMER          BRANCH_MANAGER     MANAGER         HOSTESS         KITCHEN/HALL    POS/MANAGER
   │                    │                │              │                  │              │
   │ 예약 요청          │                │              │                  │              │
   ├───────────────────▶│                │              │                  │              │
   │                    │ confirmed      │              │                  │              │
   │ WhatsApp 확인      │                │              │                  │              │
   │◀───────────────────┤                │              │                  │              │
   │                    │                │              │                  │              │
   │ 매장 도착          │                │              │                  │              │
   ├──────────────────────────────────▶ │              │                  │              │
   │                    │                │ 체크인       │                  │              │
   │                    │                │ 호스티스 배정 │                  │              │
   │                    │                ├─────────────▶│                  │              │
   │                    │                │              │ 세션 시작        │              │
   │                    │                │              │                  │              │
   │ F&B 주문           │                │              │                  │              │
   ├──────────────────────────────────────────────────────────────────▶  │              │
   │                    │                │              │                  │ POS 입력     │
   │                    │                │              │                  ├─────────────▶│
   │                    │                │              │                  │              │
   │                    │                │              │                  │ 주문 처리    │
   │                    │                │              │                  │ 서빙        │
   │                    │                │              │                  │              │
   │ 체크아웃 요청       │                │              │                  │              │
   ├───────────────────────────────────▶│              │                  │              │
   │                    │                │ 세션 종료    │                  │              │
   │                    │                ├─────────────▶│                  │              │
   │                    │                │              │ 호스티스 세션 종료              │
   │                    │                │              │                  │              │
   │ 결제               │                │              │                  │              │
   │◀──────────────────────────────────────────────────────────────────────────────────│
   │                    │                │              │                  │ 폴리오 마감 │
```

### 14.2 데이터 핸드오프 책임

| From | To | Trigger | 데이터 |
|---|---|---|---|
| CUSTOMER | BRANCH_MANAGER | 예약 생성 | reservation row |
| BRANCH_MANAGER | MANAGER | 체크인 | session row + folio row |
| MANAGER | HOSTESS | 호스티스 배정 | hostess_session row |
| HOSTESS | (자동) | 체크인/아웃 버튼 | hostess_session.start/end |
| POS | KITCHEN/HALL | 주문 입력 | order row + Socket.io 푸시 |
| KITCHEN | HALL | Ready 전환 | order.status='ready' + 푸시 |
| HALL | POS | 서빙 완료 | order.status='completed' |
| MANAGER | BRANCH_MANAGER | 일일보고서 작성 | daily_report row |
| (야간 배치) | INVESTOR | aggregation job | investor_reports row |

---

## 15. 권한 매트릭스 (요약)

| 메뉴 | SA | AD | BM | MG | IN | HO | DR | KI | HL | GN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 메인 대시보드 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 룸 보드 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 예약 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| POS | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 직원/호스티스/에이전시/스케줄/출퇴근 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 인보이스/보고서/일일보고서 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 주주 관리 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 투자자 대시보드/보고서 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 지점 관리 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 메뉴 설정 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **사용자 관리** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 역할별 전용 대시보드 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅* | ✅* | ✅* | ✅* | ✅* |
| 내 프로필 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 내 원장 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* 본인 역할 대시보드만

```typescript
// shared/constants/route-permissions.ts
// MIGRATION: convert to .NET [Authorize(Policy="...")] attributes

export const ROUTE_PERMISSIONS = {
  '/dashboard':              ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/room-board':             ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/reservations':           ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/pos':                    ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/products':               ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/staff':                  ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/hostess':                ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/agencies':               ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/schedule-builder':       ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/attendance':             ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/invoices':               ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/table-classes':          ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/daily-report':           ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/reports':                ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/shareholders':           ['SUPER_ADMIN', 'ADMIN'],
  '/investor-dashboard':     ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],
  '/investor-reports':       ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],
  '/settings/branches':      ['SUPER_ADMIN', 'ADMIN'],
  '/settings/menu':          ['SUPER_ADMIN', 'ADMIN'],
  '/settings/users':         ['SUPER_ADMIN'],
  '/dashboards/branch-manager': ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'],
  '/dashboards/manager':        ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'],
  '/dashboards/hostess':        ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'HOSTESS'],
  '/dashboards/driver':         ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'DRIVER'],
  '/dashboards/kitchen':        ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'KITCHEN'],
  '/dashboards/hall':           ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'HALL'],
  '/dashboards/general':        ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'GENERAL'],
  '/my-profile':                ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','MANAGER','INVESTOR','HOSTESS','DRIVER','KITCHEN','HALL','GENERAL'],
  '/my-ledger':                 ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','MANAGER','HOSTESS','DRIVER','KITCHEN','HALL','GENERAL'],
} as const;
```

---

## 16. 구현 체크리스트 (작업당 self-check)

작업이 끝나기 전 다음을 모두 만족하는지 확인:

- [ ] 영향받는 역할의 워크플로우(§3~§13)에 변경사항 반영됐는가?
- [ ] 다른 역할로의 핸드오프(§14)가 깨지지 않았는가?
- [ ] 라우트가 `ROUTE_PERMISSIONS` (§15)에 등록됐는가?
- [ ] 사이드바(`client/src/config/sidebar.ts`)에 메뉴가 추가됐는가?
- [ ] 6개 언어(en, zh, ms, ja, ko, th) i18n 키가 추가됐는가?
- [ ] 쓰기 작업이면 `audit.log()` 호출이 있는가?
- [ ] BRANCH_MANAGER/MANAGER 이하 역할은 `branch_id` 스코핑이 적용됐는가?
- [ ] 실시간 상태 변경이면 Socket.io 이벤트가 푸시되는가?
- [ ] `// MIGRATION:` 주석이 .NET 전환이 비자명한 곳에 추가됐는가?
- [ ] **기존 라우트/컴포넌트/권한 엔트리를 삭제하지 않았는가?** (Add Only)

---

## 17. Anti-Patterns (절대 금지)

```
❌ 룸 보드를 DB 폴링으로 갱신       → Socket.io 푸시 사용
❌ 호스티스 체크아웃 즉시 커미션 표시  → 폴리오 확정 후 표시
❌ INVESTOR가 라이브 PII 데이터 조회   → investor_reports 집계만
❌ 예약/폴리오 DELETE                → status='cancelled' 등 soft state
❌ 세션 시작 시 커미션 계산           → 세션 종료 + F&B 확정 후 계산
❌ 단일 폴리오 강제                  → 그룹은 split billing 지원
❌ 에이전시 호스티스를 직고용처럼 처리 → hostess.source 분기
❌ 세금/통화 하드코딩                → 지점별 branch_tax_config
❌ 로컬타임 DB 저장                  → 항상 UTC, 표시 시 변환
❌ 고객/스태프 JWT 시크릿 공유        → CUSTOMER_JWT_SECRET 분리
```

---

*End of specification. 라우트, 사이드바, 권한 변경이 있을 때마다 이 문서를 함께 업데이트할 것.*
