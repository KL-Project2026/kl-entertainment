# Overview

KL Project is a multi-branch KTV (Karaoke) business management platform designed for KL Entertainment Group. It aims to streamline operations across various branches, offering comprehensive features for managing rooms, products, reservations, staff, finances, and customer interactions. The platform includes both a staff-facing web application and a customer portal for bookings and profile management.

The project's vision is to provide a robust, scalable, and user-friendly system that enhances operational efficiency, improves customer experience, and provides valuable business insights through detailed reporting and real-time dashboards.

# User Preferences

I prefer simple language. I want iterative development. Ask before making major changes.

# System Architecture

The project is structured as a pnpm monorepo using TypeScript, with distinct `api-server` and `web-app` artifacts.

**UI/UX Decisions:**
- **Staff Web App:** Utilizes React with Vite, Tailwind CSS, Shadcn UI components, and Framer Motion for animations. The design theme is generally dark luxury.
- **Customer Portal:** Features a distinct light amber theme for its login and dashboard pages.
- **Internationalization (i18n):** Supports 6 locales (en, zh, ms, ja, ko, th) with `i18next` and `react-i18next`, using a default namespace `"t"`. Language preferences are stored in `localStorage["kl_lang"]`.

**Technical Implementations:**
- **API Server (`artifacts/api-server`):** Built with Express 5, handling RESTful APIs and real-time communication via Socket.io.
  - **Authentication:** JWT-based with 24h access tokens and 30d refresh tokens. Implements role-based access control (RBAC).
  - **Middleware:** Includes authentication, RBAC, and an auto-audit log.
  - **API Codegen:** Uses Orval to generate API clients and Zod schemas from an OpenAPI specification (`lib/api-spec/openapi.yaml`).
  - **Real-time:** Socket.io facilitates real-time room board updates. Clients `join_branch` and receive `room_board_update` events.
  - **Order Service:** Handles product ordering, tax calculation (10% service charge, 6% SST), and finalization. Discount percentages are stored as 0.0-1.0 in the DB.
- **Web Application (`artifacts/web-app`):** A React application using TanStack Query for data fetching, Zustand for state management, Recharts for data visualization, and Wouter for routing.
  - **Auth Stores:** Separate Zustand stores for staff (`kl-auth-storage`) and customer (`kl-customer-storage`) authentication tokens.
  - **Customer Portal:** Located under `/customer/*` paths, with a dedicated authentication flow and fetch interceptor to prevent staff token injection.
- **Database Interaction:** Drizzle ORM is used for PostgreSQL database interactions. Schemas are defined in `lib/db/schema/`. Timestamps use `timestamp({ withTimezone: true })`.
- **Multilingual Fields:** JSONB objects `{ en, zh, ms, ko, ja, th }` are used for multilingual data in the database, with `en` always required.
- **Monorepo Tooling:** pnpm workspaces manage dependencies and build processes. All packages extend a base `tsconfig.base.json` with `composite: true`.

**Feature Specifications:**
- **Dashboard:** Provides branch statistics and revenue charts.
- **Room Board:** Real-time display of room statuses.
- **Product Catalog:** Supports a 3-level hierarchy (Groups, Types, Products).
- **Reservations:** Includes CRUD operations, state machine transitions, and a booking wizard.
- **Point of Sale (POS):** Workflow for creating orders, adding items, finalizing, and processing payments.
- **Staff Management:** CRUD for staff, clock-in/out, attendance tracking, and earnings reports.
- **RBAC (Chunk 01 — Investor):** Investor role with `investorBranchScope` in JWT; investor report endpoints (`GET/POST /investor/reports`, `GET /investor/kpis`, `GET /investor/reports/export/:period`); investor-reports page.
- **RBAC (Chunk 02 — Manager/Hostess):** Branch-scope + self-only middleware guards; manager routes (dashboard, active hostesses, commissions, attendance); hostess portal routes (my-assignments, my-commissions, today-status, clock-in with GPS, clock-out with GPS); Socket.io `join_branch` role filtering; POS order access guards with field masking; Hostess Dashboard page (`/hostess-dashboard`) with attendance clock-in/out (GPS), commission summary, and assignment list.
- **RBAC (Chunk 03 — Driver/Customer/Nightly Job):** `driver_messages` table; driver routes (my-jobs with field masking, status update, send/list messages); customer portal extensions (PATCH cancel alias, my-invoices, my-profile); `jobs/investorReportJob.ts` nightly aggregation (reads orders/hostess_sessions, upserts investor_reports — idempotent); `POST /api/admin/reports/regenerate` manual trigger (admin only); `middleware/fieldMask.ts` generic field masking; role-based nav guard in `layout.tsx` (each nav item has `roles[]` array, filtered by `user.role`).
- **Scheduling:** Weekly shift schedule builder with copy functionality.
- **Agency Management:** Talent agency CRUD (`/agencies`), hostess contract assignment with split commission bars (hostess% / agent%), account summary tab with per-hostess session/revenue/cut breakdown, revenue detail modal (admin-only, CSV export). API: `agency-mgmt.ts` with full CRUD + 7 sub-endpoints. DB: `agent_hostess_contracts` (with `chk_commission_sum` = 100%), `agent_invoices` tables. 7 agencies seeded with 201 contracts.
- **Agent Management:** CRUD for agents, commission statements, and payout tracking.
- **Shareholder & Investor Management:** CRUD for shareholders, equity tracking, settlement generation, and an investor dashboard.
- **Reporting:** Tabbed reports for Revenue, Occupancy, Commissions, and Profit & Loss with charts.
- **Customer Booking Portal:** Allows customers to register, login, view upcoming bookings, and make new reservations through a 3-step wizard.
- **Room Board Date & Type Filters:** Room board now has a date navigator (prev/next day arrows + date input, defaults to today) and a room type filter dropdown. Today mode shows live status with a pulsing "Live" indicator and real-time WebSocket updates; other dates show scheduled reservations for each room (date-view mode with "No Booking" placeholders). API (`GET /branches/:id/room-board?date=YYYY-MM-DD`) returns `isLive`, `viewDate`, `roomTypes`, and `reservationStatus` per room.

**Chunk 07 — List Page Audit & UI Polish (COMPLETE):**
- `utils.ts`: Added `formatDate(iso)` and `formatDateTime(iso)` helpers (use `toLocaleDateString` / `toLocaleString`).
- `attendance.tsx`: workDate and today columns use `formatDate()`. Added `isFetching` loading overlay (Loader2 spinner) on the attendance table during bulk refetch.
- `agents.tsx`: Added text search input (Search agents…); filter applies to name, email, and contact. Balance now uses `formatCurrency()` instead of raw `RM X.XX`.
- `shareholders.tsx`: Added text search input (Search shareholders…); filter applies to name, email, nationality. Settlement `period_start`/`period_end` use `formatDate()`.
- `products.tsx`: Added text search input (Search products…); filters by `name.en` and `name.zh`.
- `branches.tsx`: Added empty-state div when `filteredBranches.length === 0` (distinguishes "no data" vs "no match").
- `reservations.tsx`: Added Cards/Table view toggle in the header. Table view shows Booking #, Status, Customer, Room, Date (formatted), Time, Guests, Deposit. Imported `formatDate` for date column.

**Detail Pages / Click-to-Detail (COMPLETE):**
- `reservation-detail.tsx` (`/reservations/:id`): Full reservation detail page — booking info, customer, deposit, hostess list, action buttons (Confirm/Check-In/Check-Out/Cancel/Open POS), inline cancel modal.
- `staff-detail.tsx` (`/staff/:id`): Staff profile with role badge, inline edit form (name/phone/email/employment type), earnings summary, this-month attendance table, Clock In/Out buttons.
- `agent-detail.tsx` (`/agents/:id`): Agent profile with inline edit, outstanding balance card, assigned hostesses grid, recent payout list.
- `shareholder-detail.tsx` (`/shareholders/:id`): Shareholder profile with inline edit, equity stakes per branch, settlement history table.
- `App.tsx` routes: Added `/reservations/:id`, `/staff/:id`, `/agents/:id`, `/shareholders/:id`.
- List pages `onRowClick`: `reservations.tsx`, `staff.tsx`, `agents.tsx`, `shareholders.tsx` all navigate to their respective detail pages on row/card click.
- All fetch calls in detail pages leverage the global JWT interceptor in App.tsx (no manual auth headers needed).

## Room & Table Management (COMPLETE)

**Database:** Two new tables: `room_tables` (branch_id, name, type ROOM/TABLE/BOOTH, capacity_min/max, amenities JSONB, floor, status ACTIVE/INACTIVE/MAINTENANCE/OUT_OF_ORDER, image_urls JSONB, sort_order) and `room_table_pricing` (room_table_id FK, price_label, price_type PER_HOUR/PER_SESSION/FLAT_RATE, base_price MYR, applicable_days bitmask Mon=1…Sun=64, time_start/time_end, date_from/date_to, priority, is_active). PostgreSQL function `get_applicable_price(room_table_id, timestamptz)` resolves the highest-priority matching pricing rule.

**API Route** `artifacts/api-server/src/routes/room-tables.ts`:
- `GET /api/room-tables` — list with branch/type/status/search filters + summary stats
- `POST /api/room-tables` — create (ADMIN_UP)
- `GET /api/room-tables/:id` — detail with all pricing rules
- `PATCH /api/room-tables/:id` — update (ADMIN_UP)
- `DELETE /api/room-tables/:id` — soft-delete → status=INACTIVE (ADMIN_UP)
- `GET /api/room-tables/:id/pricing` — list pricing rules
- `POST /api/room-tables/:id/pricing` — add pricing rule (ADMIN_UP)
- `PATCH /api/room-tables/:id/pricing/:priceId` — update pricing rule (ADMIN_UP)
- `DELETE /api/room-tables/:id/pricing/:priceId` — delete pricing rule (ADMIN_UP)
- `GET /api/room-tables/:id/effective-price?datetime=` — resolve price via PostgreSQL function

**Frontend:**
- `tables.tsx` — List page: 4 summary stat cards, branch/type/status/search filters, 3-col card grid with type badge (ROOM/TABLE/BOOTH colored), amenities chips, pricing preview, Edit + View Detail actions. Add/Edit modal with full form.
- `table-detail.tsx` — Detail page: Info tab (basic info + amenities chips) and Pricing tab (rules with day-of-week circle pills, time window, CRUD add/edit/delete modals with bitmask day selector).
- Nav item "Tables" → renamed to "Room & Table" in layout.tsx + all 6 locale files.

**Seed Data:** 14 rooms seeded across Club Noir KL (6), Velvet Lounge PJ (5), Eclipse Lounge JB (3); 20 pricing rules.

**Availability endpoint** `GET /api/room-tables/availability?date=&branch_id=`: Returns all room_tables for the branch with reservations (joined from reservations table via room name matching), applicable price per room (via `get_applicable_price()`), daily revenue per room, and branch daily total revenue.

**Availability Calendar UI** (`tables.tsx`): Grid/Availability toggle in the header. Availability view shows date picker + branch selector + horizontal timeline grid (Y: rooms, X: hourly slots 12:00-03:00). Booked slots rendered as colored blocks with guest name + hover tooltip (guest, pax, status, revenue). Per-room revenue column on right. Branch daily revenue summary card at bottom.

**Socket.io**: `PATCH /api/room-tables/:id` emits `room_table_status_changed` to `branch:{branch_id}` room via `getSharedIo()` (exported from rooms.ts) when status field changes.

**Audit Logging**: All CREATE, UPDATE, STATUS_CHANGE, PRICING_DEACTIVATED mutations on `room_tables` and `room_table_pricing` write to `audit_log` table via raw pool.query (entity_type, entity_id, action, changed_by, old_values, new_values, ip_address, user_agent).

**Pricing Soft-Delete**: `DELETE /api/room-tables/:id/pricing/:priceId` sets `is_active = false` (never hard-deletes). Audit logged as `PRICING_DEACTIVATED`.

**i18n**: `room_table.*` namespace (16 keys: menu_label, type_room, type_table, type_booth, pricing_rules, add_pricing_rule, applicable_days, time_window, date_range, price_per_hour, price_per_session, price_flat_rate, daily_revenue, availability_view, no_pricing_rules) added to all 6 locale files (en, ms, zh, ko, ja, th).

## Production Database Seeding

The development database full snapshot is stored at:
`artifacts/api-server/src/scripts/prod-full-seed.sql`

**Automatic (on first deploy):** On every startup, `initProductionDb()` checks if the database has tables. If the database is empty (fresh production deployment), it automatically applies `prod-full-seed.sql` via `psql`. Subsequent startups skip the seed (tables already exist).

**Manual restore (any target):**
```bash
TARGET_DATABASE_URL="postgres://..." pnpm --filter @workspace/api-server db:restore
```
Skips if target already has tables. To force overwrite, drop the schema first:
```bash
psql "$TARGET_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

**Re-snapshot:** To regenerate `prod-full-seed.sql` from the current dev DB:
```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl --no-comments --schema=public -f artifacts/api-server/src/scripts/full-db-dump.sql
sed -e '/^\\restrict/d' -e 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' \
    -e 's/^COMMENT ON SCHEMA public IS/-- COMMENT ON SCHEMA public IS/' \
    artifacts/api-server/src/scripts/full-db-dump.sql > artifacts/api-server/src/scripts/prod-full-seed.sql
rm artifacts/api-server/src/scripts/full-db-dump.sql
```

# External Dependencies

-   **Database:** PostgreSQL (with Drizzle ORM)
-   **Messaging:**
    -   WhatsApp Cloud API (for sending booking confirmations)
    -   Telegram Bot API (optional)
-   **Financial Data:** ExchangeRate API (for FX rates)
**RBAC Chunk 01 — Investor Role & Reports Infrastructure (COMPLETE):**
- DB migrations: `investor_branch_scope JSONB` + `last_login_at` on `staff`; `investor_reports` table (UUID PKs, org_id, branch_id, MYR currency, 20+ metric columns, unique constraint on org_id+branch_id+period); `investor_export_logs` table (UUID PK, staff_id, watermark, format, IP).
- `config/constants.ts`: Added `INVESTOR` to ROLES; added `ROLE_LEVEL` hierarchy map (super_admin=100 → general=20); added `TABLE_PERMISSIONS` matrix.
- `middleware/auth.ts`: `JwtPayload` now includes `investorBranchScope?: string[]` and `orgId?: string | null`.
- `middleware/rbac.ts`: Added `requireMinLevel(level)`, `branchScope`, `investorOnly` helpers. Fixed `.includes()` type-casting to `as string[]`.
- `routes/auth.ts`: Login now reads `investor_branch_scope` from `staff` table, includes it in JWT payload and login response. Updates `last_login_at` on each login (non-blocking).
- `routes/investor.ts`: Added `GET /investor/reports` (scope-filtered by investorBranchScope for investor role), `GET /investor/kpis` (monthly aggregates), `GET /investor/reports/export/:period` (with audit log + watermark), `POST /investor/reports` (upsert with ON CONFLICT). All GET routes protected by `investorOnly` (admin + investor only).
- `pages/investor-reports.tsx` + route `/investor-reports`: KPI summary cards (latest month), expandable report rows (revenue breakdown, profitability, operational KPIs), Add Report form, period filter, export button.
- Layout + i18n: Nav item `nav.investor_reports` added for en/ms/zh locales.
