# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This is **KL Project** — a multi-branch KTV (Karaoke) business management platform for KL Entertainment Group.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (bcryptjs + jsonwebtoken), 24h access token, 30d refresh
- **Real-time**: Socket.io on `artifacts/api-server` (room board updates)
- **Frontend**: React + Vite, Tailwind, Shadcn, TanStack Query, Zustand, Framer Motion, Recharts, Wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/          # Express 5 API + Socket.io (port 8080)
│   │   └── src/
│   │       ├── config/constants.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts           # JWT verify middleware
│   │       │   ├── rbac.ts           # Role-based access control
│   │       │   └── audit.ts          # Auto audit log
│   │       └── routes/
│   │           ├── index.ts          # Router aggregator
│   │           ├── health.ts         # GET /api/healthz
│   │           ├── auth.ts           # POST /login, /logout, /refresh, GET /me
│   │           ├── branches.ts       # CRUD + dashboard + room-board
│   │           ├── rooms.ts          # CRUD + status + Socket.io emitter
│   │           ├── products.ts       # Groups, Types, Products CRUD
│   │           ├── reservations.ts   # CRUD + state machine transitions
│   │           ├── orders.ts         # Orders + order items + finalize + receipt
│   │           ├── receipts.ts       # GET receipt HTML + print tracking
│   │           ├── staff.ts          # Staff CRUD + clock-in/out + earnings
│   │           ├── schedules.ts      # Weekly shift schedule + copy prev week
│   │           ├── agents.ts         # Agent CRUD + commission statement + payout
│   │           └── staff-availability.ts  # Staff availability legacy
│   └── web-app/             # React + Vite frontend (previewPath: /)
│       └── src/
│           ├── pages/
│           │   ├── login.tsx         # Dark luxury login with language selector
│           │   ├── dashboard.tsx     # Branch stats + revenue chart
│           │   ├── room-board.tsx    # Real-time room grid + Socket.io
│           │   ├── branches.tsx      # Branch list/CRUD
│           │   ├── products.tsx      # 3-level product catalog
│           │   ├── reservations.tsx  # Reservations list + state transitions
│           │   ├── booking-wizard.tsx # New reservation wizard
│           │   ├── pos.tsx           # Point of Sale (POS) + payment modal
│           │   ├── staff.tsx         # Staff list + add/edit + clock modal + earnings modal
│           │   ├── schedule-builder.tsx # Weekly grid editor + copy-last-week
│           │   ├── attendance.tsx    # Today clock-in/out table + historical view
│           │   └── agents.tsx        # Agent CRUD + commission statement + payout
│           ├── components/
│           │   ├── ui.tsx            # Shared UI components
│           │   └── layout.tsx        # Sidebar layout
│           ├── hooks/
│           │   └── use-live-timer.ts
│           ├── lib/
│           │   ├── auth.ts           # Zustand auth store (key: 'kl-auth-storage'), token field
│           │   └── utils.ts
│           └── App.tsx
├── lib/
│   ├── api-spec/            # openapi.yaml + Orval config
│   ├── api-client-react/    # Generated React Query hooks (lib/api-client-react/src/generated/api.ts)
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle ORM schema + DB connection (23 tables)
└── ...
```

## Database Schema (24 Tables)

| # | Table | File |
|---|-------|------|
| 1 | `organizations` | `schema/organizations.ts` |
| 2 | `branches` | `schema/branches.ts` |
| 3 | `rooms` | `schema/rooms.ts` |
| 4 | `product_groups` | `schema/products.ts` |
| 5 | `product_types` | `schema/products.ts` |
| 6 | `products` | `schema/products.ts` |
| 7 | `agents` | `schema/agents.ts` |
| 8 | `staff` | `schema/staff.ts` |
| 9 | `staff_schedules` | `schema/staff.ts` |
| 10 | `attendance` | `schema/staff.ts` |
| 11 | `customers` | `schema/customers.ts` |
| 12 | `reservations` | `schema/reservations.ts` |
| 13 | `reservation_hostesses` | `schema/reservations.ts` |
| 14 | `reservation_pickups` | `schema/reservations.ts` |
| 15 | `orders` | `schema/orders.ts` |
| 16 | `order_items` | `schema/orders.ts` |
| 17 | `receipts` | `schema/receipts.ts` |
| 18 | `expenses` | `schema/finances.ts` |
| 19 | `shareholders` | `schema/finances.ts` |
| 20 | `branch_shareholders` | `schema/finances.ts` |
| 21 | `profit_settlements` | `schema/finances.ts` |
| 22 | `fx_rates` | `schema/fx_rates.ts` |
| 23 | `audit_log` | `schema/audit_log.ts` |
| 24 | `agent_payouts` | `schema/finances.ts` (added via raw SQL) |

### Seed Data

- 1 Organization: `KL Entertainment Group` (slug: `kl-entertainment`, id: `00000000-0000-0000-0000-000000000001`)
- 2 Branches: `Club Noir KL` (KL01, id: `d44ca290-a086-439d-9657-07fc5ebb689c`), `Velvet Lounge PJ` (KL02)
- 3 Product Groups: Beverages, Food, Packages (multilingual JSONB)
- 9 Products: beers, whisky, spirits, food combos, KTV packages (unit_price, not sellingPrice)
- 4 Sample Reservations including `RES-E2E` (id: `420b76ff-8f2c-4208-91fd-63e65606933c`, branch: KL01)
- 4 FX Rates: MYR→AUD, KRW, JPY, CNY
- 3 Staff users:
  - `admin@klproject.com` / `Admin@123!` (super_admin, branchId: KL01)
  - `kl01@klproject.com` / `Manager@123!` (branch_manager — Club Noir KL)
  - `kl02@klproject.com` / `Manager@123!` (branch_manager — Velvet Lounge PJ)
- 6 rooms per branch (Standard ×3, VIP ×2, VVIP ×1)

## Authentication

- JWT via `Authorization: Bearer <token>` header or `accessToken` cookie
- Access token: 24h (JWT_SECRET)
- Refresh token: 30d (REFRESH_TOKEN_SECRET)
- Required env vars: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_EXPIRY`, `REFRESH_TOKEN_EXPIRY`
- Roles: `super_admin`, `admin`, `branch_manager`, `manager`, `hostess`, `driver`, `kitchen`, `hall`, `general`
- Zustand auth store key: `kl-auth-storage`, token field: `token` (not `accessToken`)

## Socket.io (Room Board)

- Server on same HTTP server as Express
- Client emits `join_branch` `{ branchId }` to subscribe
- Server emits `room_board_update` with room status changes

## API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /api/healthz | — | |
| POST | /api/auth/login | — | returns `{ accessToken, refreshToken, user }` |
| POST | /api/auth/logout | Bearer | |
| POST | /api/auth/refresh | — | |
| GET | /api/auth/me | Bearer | |
| GET | /api/branches | Bearer | |
| POST | /api/branches | super_admin | |
| GET | /api/branches/:id | Bearer | |
| PUT | /api/branches/:id | admin+ | |
| GET | /api/branches/:id/dashboard | Bearer | |
| GET | /api/branches/:id/room-board | Bearer | |
| GET | /api/rooms | Bearer | |
| GET | /api/rooms/available | Bearer | |
| POST | /api/rooms | manager+ | |
| PUT | /api/rooms/:id | manager+ | |
| PUT | /api/rooms/:id/status | manager | |
| GET | /api/products/groups | Bearer | |
| POST | /api/products/groups | admin+ | |
| GET | /api/products/types | Bearer | |
| POST | /api/products/types | admin+ | |
| GET | /api/products | Bearer | response: `{ unitPrice }` (not `sellingPrice`) |
| POST | /api/products | manager+ | |
| PUT | /api/products/:id | manager+ | |
| PUT | /api/products/:id/toggle | manager+ | |
| GET | /api/reservations | Bearer | |
| POST | /api/reservations | Bearer | |
| GET | /api/reservations/:id | Bearer | |
| PUT | /api/reservations/:id | Bearer | |
| POST | /api/reservations/:id/transition | Bearer | state machine |
| GET | /api/orders | Bearer | ?reservationId=, ?branchId= |
| POST | /api/orders | Bearer | body+URL query: branchId, reservationId; falls back to reservation lookup, then JWT branchId |
| POST | /api/orders/:id/items | Bearer | adds item, recalculates totals |
| DELETE | /api/orders/:id/items/:itemId | Bearer | |
| POST | /api/orders/:id/finalize | manager+ | sets finalizedAt only |
| GET | /api/orders/:id/invoice | Bearer | returns HTML |
| POST | /api/orders/:id/receipt | Bearer | creates receipt + sets payment_status='paid' |
| GET | /api/orders/:id/receipt/latest | Bearer | |
| GET | /api/receipts/:id | Bearer | returns HTML |
| POST | /api/receipts/:id/printed | Bearer | |
| GET | /api/staff/availability | Bearer | legacy availability check |
| GET | /api/staff | Bearer | ?branch_id=, ?role=, ?active= |
| POST | /api/staff | manager+ | create staff member |
| GET | /api/staff/:id | Bearer | |
| PUT | /api/staff/:id | manager+ | |
| DELETE | /api/staff/:id | admin+ | soft delete |
| POST | /api/staff/:id/clock-in | Bearer | `{ branchId }` → creates attendance record |
| POST | /api/staff/:id/clock-out | Bearer | updates attendance clockOut |
| GET | /api/staff/:id/attendance | Bearer | ?from=, ?to= |
| GET | /api/staff/:id/earnings | Bearer | ?from=, ?to= → `{ sessions, grossEarnings, agentDeductions, penalties, netEarnings }` |
| GET | /api/schedules | Bearer | ?branch_id=, ?effective_date= |
| POST | /api/schedules | manager+ | upsert shift (staffId, dayOfWeek, shiftStart, shiftEnd, isOvernight, effectiveFrom) |
| DELETE | /api/schedules/:id | manager+ | |
| POST | /api/schedules/copy | manager+ | `{ branchId, fromDate, toDate }` copies prior week |
| GET | /api/agents | Bearer | ?org_id= |
| POST | /api/agents | admin+ | create agent |
| GET | /api/agents/:id | Bearer | |
| PUT | /api/agents/:id | admin+ | |
| GET | /api/agents/:id/statement | Bearer | ?from=, ?to= → commission statement with hostess breakdown |
| POST | /api/agents/:id/payout | admin+ | records payout, updates agent.credit_balance |

## POS Flow

1. Navigate to `/pos?branchId=BRANCH_ID&reservationId=RES_ID`
2. Click "Open New Order" → `POST /api/orders?reservationId=RES_ID` with body `{ branchId, reservationId }`
3. Add items → `POST /api/orders/:id/items`
4. Click "Finalize Order" → `POST /api/orders/:id/finalize`
5. PaymentModal → Click "Pay Now" → `POST /api/orders/:id/receipt` with `{ paymentMethod, receiptMode }`
6. Opens `/api/receipts/:id?mode=detailed` in new tab

## Order Service (Tax Calculation)

- Subtotal: sum of `lineTotal` for all items
- Service charge: 10% of subtotal
- SST: 6% of subtotal
- Total: subtotal + service + SST
- `discount_pct`: stored as 0.0-1.0 in DB (numeric(5,4)); frontend/API send 0-100, backend converts

## Constants (`artifacts/api-server/src/config/constants.ts`)

- `ROLES` — super_admin, admin, branch_manager, manager, hostess, driver, kitchen, hall, general
- `RESERVATION_STATUSES` + `VALID_TRANSITIONS` — state machine
- `PAYMENT_METHODS` — cash, qr_touchngo, qr_grabpay, fpx, card, credit_account, bank_transfer
- `SUPPORTED_LANGUAGES` — en, zh, ms, ja, ko, th
- `SUPPORTED_CURRENCIES` — MYR, AUD, KRW, JPY, CNY

## Critical Notes

- **Drizzle timestamps**: Use `timestamp({ withTimezone: true })` NOT `timestamptz` (not exported)
- **staff.branch_id**: NOT NULL — every staff must be attached to a branch
- **staff.email**: No unique constraint; use `SELECT ... WHERE NOT EXISTS` for upsert
- **Multilingual fields**: JSONB objects `{ en, zh, ms, ko, ja, th }` — `en` is always required
- **Currency**: MYR base, SST 6%, service charge 10%
- **Radix Select**: Never use empty string `""` as value — use sentinel like `__all__`
- **product_groups**: NO `branch_id` column; **products**: NO `updated_at` column (has `deleted_at`)
- **reservations**: NO `org_id` column
- **POST /api/orders branchId resolution chain**: body.branchId → URL query branchId → reservation lookup → JWT user.branchId
- **products.unit_price** maps to API response field `unitPrice` (NOT `sellingPrice`)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from root:

- `pnpm run build` — typecheck + recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod schemas
