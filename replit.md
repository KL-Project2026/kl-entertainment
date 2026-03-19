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

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
│       └── src/
│           ├── config/
│           │   └── constants.ts  # ROLES, STATUSES, PAYMENT_METHODS, enums
│           └── routes/
│               └── health.ts     # GET /api/healthz — checks DB connectivity
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/     # All 13 schema files (23 tables total)
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema (Chunk 01)

All tables use UUID primary keys with `gen_random_uuid()`. Timestamps use `timestamp({ withTimezone: true })`.

### Tables (23 total)

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

## Constants (`artifacts/api-server/src/config/constants.ts`)

- `ROLES` — super_admin, admin, branch_manager, manager, hostess, driver, kitchen, hall, general
- `RESERVATION_STATUSES` + `VALID_TRANSITIONS` — state machine for booking flow
- `PAYMENT_METHODS` — cash, qr_touchngo, qr_grabpay, fpx, card, credit_account, bank_transfer
- `SUPPORTED_LANGUAGES` — en, zh, ms, ja, ko, th
- `SUPPORTED_CURRENCIES` — MYR, AUD, KRW, JPY, CNY
- Room types, statuses, booking channels, payment statuses, agent types, etc.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /healthz` (full path: `/api/healthz`) — also checks DB connectivity
- Constants: `src/config/constants.ts` — all business enums and lookup tables
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- Drizzle note: use `timestamp({ withTimezone: true })` NOT `timestamptz` (not exported by this version)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`).

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`.
