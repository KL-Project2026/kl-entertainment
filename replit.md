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
- **Scheduling:** Weekly shift schedule builder with copy functionality.
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

# External Dependencies

-   **Database:** PostgreSQL (with Drizzle ORM)
-   **Messaging:**
    -   WhatsApp Cloud API (for sending booking confirmations)
    -   Telegram Bot API (optional)
-   **Financial Data:** ExchangeRate API (for FX rates)