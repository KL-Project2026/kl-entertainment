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
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (bcryptjs + jsonwebtoken), 24h access token, 30d refresh
- **Real-time**: Socket.io on `artifacts/api-server` (room board updates)
- **Frontend**: React + Vite, Tailwind, Shadcn, TanStack Query, Zustand, Framer Motion, Recharts, Wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/          # Express 5 API + Socket.io
│   │   └── src/
│   │       ├── config/constants.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts        # JWT verify middleware
│   │       │   ├── rbac.ts        # Role-based access control
│   │       │   └── audit.ts       # Auto audit log
│   │       └── routes/
│   │           ├── index.ts       # Router aggregator
│   │           ├── health.ts      # GET /api/healthz
│   │           ├── auth.ts        # POST /login, /logout, /refresh, GET /me
│   │           ├── branches.ts    # CRUD + dashboard + room-board
│   │           ├── rooms.ts       # CRUD + status + Socket.io emitter
│   │           └── products.ts    # Groups, Types, Products CRUD
│   └── web-app/             # React + Vite frontend (previewPath: /)
│       └── src/
│           ├── pages/
│           │   ├── login.tsx      # Dark luxury login with language selector
│           │   ├── dashboard.tsx  # Branch stats + revenue chart
│           │   ├── room-board.tsx # Real-time room grid + Socket.io
│           │   ├── branches.tsx   # Branch list/CRUD
│           │   └── products.tsx   # 3-level product catalog
│           ├── components/
│           │   ├── ui.tsx         # Shared UI components
│           │   └── layout.tsx     # Sidebar layout
│           ├── hooks/
│           │   └── use-live-timer.ts
│           ├── lib/
│           │   ├── auth.ts        # Token storage + axios config
│           │   └── utils.ts
│           └── App.tsx
├── lib/
│   ├── api-spec/            # openapi.yaml + Orval config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle ORM schema + DB connection (23 tables)
└── ...
```

## Database Schema (23 Tables)

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

### Seed Data

- 1 Organization: `KL Entertainment Group` (slug: `kl-entertainment`)
- 2 Branches: `Club Noir KL` (KL01), `Velvet Lounge PJ` (KL02)
- 3 Product Groups: Beverages, Food, Packages (multilingual JSONB)
- 4 FX Rates: MYR→AUD, KRW, JPY, CNY
- 3 Staff users:
  - `admin@klproject.com` / `Admin@123!` (super_admin)
  - `kl01@klproject.com` / `Manager@123!` (branch_manager — Club Noir KL)
  - `kl02@klproject.com` / `Manager@123!` (branch_manager — Velvet Lounge PJ)
- 6 rooms per branch (Standard ×3, VIP ×2, VVIP ×1)

## Authentication

- JWT via `Authorization: Bearer <token>` header or `accessToken` cookie
- Access token: 24h (JWT_SECRET)
- Refresh token: 30d (REFRESH_TOKEN_SECRET)
- Required env vars: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_EXPIRY`, `REFRESH_TOKEN_EXPIRY`
- Roles: `super_admin`, `admin`, `branch_manager`, `manager`, `hostess`, `driver`, `kitchen`, `hall`, `general`

## Socket.io (Room Board)

- Server on same HTTP server as Express
- Client emits `join_branch` `{ branchId }` to subscribe
- Server emits `room_board_update` with room status changes

## API Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | /api/healthz | — |
| POST | /api/auth/login | — |
| POST | /api/auth/logout | Bearer |
| POST | /api/auth/refresh | — |
| GET | /api/auth/me | Bearer |
| GET | /api/branches | Bearer |
| POST | /api/branches | super_admin |
| GET | /api/branches/:id | Bearer |
| PUT | /api/branches/:id | admin+ |
| GET | /api/branches/:id/dashboard | Bearer |
| GET | /api/branches/:id/room-board | Bearer |
| GET | /api/rooms | Bearer |
| GET | /api/rooms/available | Bearer |
| POST | /api/rooms | manager+ |
| PUT | /api/rooms/:id | manager+ |
| PUT | /api/rooms/:id/status | manager |
| GET | /api/products/groups | Bearer |
| POST | /api/products/groups | admin+ |
| GET | /api/products/types | Bearer |
| POST | /api/products/types | admin+ |
| GET | /api/products | Bearer |
| POST | /api/products | manager+ |
| PUT | /api/products/:id | manager+ |
| PUT | /api/products/:id/toggle | manager+ |

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

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from root:

- `pnpm run build` — typecheck + recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod schemas
