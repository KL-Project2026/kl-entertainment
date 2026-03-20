# Overview

KL Project is a multi-branch KTV business management platform for KL Entertainment Group, aiming to streamline operations across branches. It provides a staff-facing web application and a customer portal for bookings and profile management. The platform seeks to enhance operational efficiency, improve customer experience, and offer business insights through reporting and real-time dashboards.

# User Preferences

I prefer simple language. I want iterative development. Ask before making major changes.

# System Architecture

The project is a pnpm monorepo using TypeScript, with distinct `api-server` and `web-app` artifacts.

**UI/UX Decisions:**
- **Staff Web App:** Built with React, Vite, Tailwind CSS, Shadcn UI, and Framer Motion, featuring a dark luxury theme.
- **Customer Portal:** Uses a distinct light amber theme for login and dashboard.
- **Internationalization (i18n):** Supports 6 locales (en, zh, ms, ja, ko, th) using `i18next` and `react-i18next`.

**Technical Implementations:**
- **API Server (`artifacts/api-server`):** Express 5 for RESTful APIs and Socket.io for real-time communication.
  - **Authentication:** JWT-based with RBAC.
  - **Middleware:** Authentication, RBAC, and auto-audit logging.
  - **API Codegen:** Orval generates API clients and Zod schemas from OpenAPI.
  - **Real-time:** Socket.io for room board updates.
  - **Order Service:** Manages product ordering, tax calculation (10% service charge, 6% SST), and finalization.
- **Web Application (`artifacts/web-app`):** React application utilizing TanStack Query for data, Zustand for state, Recharts for visualization, and Wouter for routing.
  - **Auth Stores:** Separate Zustand stores for staff and customer authentication.
  - **Customer Portal:** Dedicated paths and authentication flow to prevent staff token injection.
- **Database Interaction:** Drizzle ORM for PostgreSQL.
- **Multilingual Fields:** JSONB objects `{ en, zh, ms, ko, ja, th }` for multilingual data.
- **Monorepo Tooling:** pnpm workspaces with shared `tsconfig.base.json`.

**Feature Specifications:**
- **Dashboards:** Branch statistics and revenue charts.
- **Room Board:** Real-time display of room statuses, with date and type filters.
- **Product Catalog:** 3-level hierarchy (Groups, Types, Products).
- **Reservations:** CRUD operations, state machine, and booking wizard.
- **Point of Sale (POS):** Order creation, item management, finalization, and payment processing.
- **Staff Management:** CRUD, clock-in/out, attendance, and earnings.
- **Role-Based Access Control (RBAC):** Implemented with investor, manager, hostess, and driver roles, including branch-scope and field masking.
- **Scheduling:** Weekly shift schedule builder.
- **Agency & Agent Management:** CRUD for agencies and agents, contract assignments, split commissions, and payout tracking.
- **Shareholder & Investor Management:** CRUD, equity tracking, settlements, and investor dashboards.
- **Reporting:** Tabbed reports for Revenue, Occupancy, Commissions, and P&L.
- **Customer Booking Portal:** Registration, login, booking management, and reservation wizard.
- **Room & Table Management:** Database tables `room_tables` and `room_table_pricing` for managing room/table details and pricing rules. API endpoints for CRUD and effective price resolution. Frontend for listing, detail views, and availability calendar with real-time updates via Socket.io and audit logging.
- **Production Database Seeding:** Automatic seeding of `prod-full-seed.sql` on first deployment.

# External Dependencies

-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Messaging:** WhatsApp Cloud API, Telegram Bot API (optional)
-   **Financial Data:** ExchangeRate API