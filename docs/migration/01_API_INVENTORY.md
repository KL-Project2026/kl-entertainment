# 01 · API Inventory — Route Freeze

> 35 route files · Express 5 · Port 8080  
> ⚠️ HTTP method, path, and I/O schema changes are FORBIDDEN after this freeze.

## Base URL

| Environment | Base URL |
|---|---|
| Replit (dev) | `http://localhost:8080` (same origin via proxy) |
| Railway (prod) | `https://api.klproject.com` |
| Local dev | `http://localhost:8080` |

All routes are prefixed with `/api` in Express (`app.use("/api", router)`).

## Authentication

- **Header**: `Authorization: Bearer <JWT>`
- **Middleware**: `authenticate` (all protected routes)
- **Public routes**: `POST /auth/login`, `POST /auth/refresh`, customer auth routes, `GET /health`, webhooks

---

## Category: Authentication

### `auth.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | ❌ | Email + password → `{ accessToken, refreshToken, user }` |
| POST | `/auth/logout` | ✅ | Invalidate session |
| POST | `/auth/refresh` | ❌ | Refresh token → new access token |
| GET | `/auth/me` | ✅ | Current user profile |

### `customer-auth.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/customer/auth/register` | ❌ | Customer registration |
| POST | `/customer/auth/login` | ❌ | Customer login |
| GET | `/customer/profile` | ✅ customer | Get customer profile |
| PUT | `/customer/profile` | ✅ customer | Update customer profile |

---

## Category: Operations

### `reservations.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reservations` | ✅ manager_up | List reservations (paginated, filtered) |
| POST | `/reservations` | ✅ manager_up | Create reservation |
| GET | `/reservations/:id` | ✅ manager_up | Reservation detail |
| PUT | `/reservations/:id` | ✅ manager_up | Update reservation |
| DELETE | `/reservations/:id` | ✅ admin_up | Cancel/delete reservation |
| GET | `/reservations/history` | ✅ | Reservation history |

### `rooms.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rooms` | ✅ manager_up | List rooms with availability |
| POST | `/rooms` | ✅ admin_up | Create room |
| PUT | `/rooms/:id` | ✅ admin_up | Update room |
| DELETE | `/rooms/:id` | ✅ admin_up | Delete room |
| GET | `/rooms/board` | ✅ ops_up | Real-time room board data |
| **Socket** | `join_branch` / `leave_branch` | — | WebSocket room subscription |
| **Emit** | `room_board_update` | — | Broadcast room status change |

### `orders.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/orders` | ✅ ops_up | List orders |
| POST | `/orders` | ✅ ops_up | Create order (POS) |
| GET | `/orders/:id` | ✅ ops_up | Order detail |
| PUT | `/orders/:id` | ✅ ops_up | Update order |
| DELETE | `/orders/:id` | ✅ manager_up | Void order |

### `room-tables.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/room-tables` | ✅ manager_up | List room tables |
| POST | `/room-tables` | ✅ admin_up | Create table |
| PUT | `/room-tables/:id` | ✅ manager_up | Update table |
| DELETE | `/room-tables/:id` | ✅ admin_up | Delete table |
| PATCH | `/room-tables/:id/status` | ✅ ops_up | Update table status |

### `tables-api.ts` (legacy)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tables` | ✅ manager_up | List legacy tables |
| GET | `/tables/:id` | ✅ manager_up | Table detail |
| PUT | `/tables/:id` | ✅ manager_up | Update table |

---

## Category: Staff

### `staff.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/staff` | ✅ manager_up | List staff |
| POST | `/staff` | ✅ admin_up | Create staff account |
| GET | `/staff/:id` | ✅ manager_up | Staff detail |
| PUT | `/staff/:id` | ✅ manager_up | Update staff |
| PUT | `/staff/:id/password` | ✅ admin_up | Change password |
| GET | `/staff/:id/payslips` | ✅ manager_up | Staff payslips |
| POST | `/staff/:id/payslips` | ✅ admin_up | Generate payslip |

### `attendance-api.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/attendance` | ✅ manager_up | List attendance |
| GET | `/attendance/summary` | ✅ manager_up | Monthly summary |
| POST | `/attendance` | ✅ manager_up | Clock in/out |
| PUT | `/attendance/:id` | ✅ manager_up | Correct attendance |

### `schedules.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/schedules` | ✅ manager_up | Get schedule |
| POST | `/schedules` | ✅ manager_up | Create schedule |
| DELETE | `/schedules/:id` | ✅ manager_up | Delete schedule slot |

### `staff-availability.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/staff-availability` | ✅ manager_up | Staff availability overview |
| GET | `/staff-availability/:id` | ✅ manager_up | Individual availability |

---

## Category: Hostess

### `hostess-profiles.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/staff/hostesses` | ✅ manager_up | List hostess profiles |
| GET | `/staff/hostesses/:id` | ✅ manager_up | Profile detail |
| POST | `/staff/hostesses` | ✅ admin_up | Create profile |
| PATCH | `/staff/hostesses/:id` | ✅ manager_up | Update profile |
| DELETE | `/staff/hostesses/:id` | ✅ admin_up | Delete profile |

### `hostess-portal.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hostess-portal/sessions` | ✅ hostess+ | Own sessions |
| GET | `/hostess-portal/earnings` | ✅ hostess+ | Earnings summary |

### `hostessAssignments.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/hostess-assignments` | ✅ manager_up | Assign hostess to reservation |
| PATCH | `/hostess-assignments/:id/extend` | ✅ manager_up | Extend session |
| PATCH | `/hostess-assignments/:id/replace` | ✅ manager_up | Replace hostess |
| POST | `/hostess-assignments/:id/close` | ✅ manager_up | Close session → triggers commissions |
| **Emit** | `hostess:assigned` / `hostess:session-closed` | — | Real-time events |

---

## Category: Agency

### `agency-mgmt.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/agencies` | ✅ manager_up | List agencies |
| GET | `/agencies/:id` | ✅ manager_up | Agency detail |
| POST | `/agencies` | ✅ admin_up | Create agency |
| PATCH | `/agencies/:id` | ✅ admin_up | Update agency |
| DELETE | `/agencies/:id` | ✅ admin_up | Delete agency |
| GET | `/agencies/:id/hostesses` | ✅ manager_up | Agency's hostesses |
| POST | `/agencies/:id/contracts` | ✅ admin_up | Create contract |
| PATCH | `/agencies/:id/contracts/:cid` | ✅ admin_up | Update contract |
| DELETE | `/agencies/:id/contracts/:cid` | ✅ admin_up | Terminate contract |
| GET | `/agencies/:id/commissions` | ✅ manager_up | Commission history |

### `agents.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/agents` | ✅ admin_up | List agents |
| POST | `/agents` | ✅ admin_up | Create agent |
| GET | `/agents/:id` | ✅ admin_up | Agent detail |
| PUT | `/agents/:id` | ✅ admin_up | Update agent |
| GET | `/agents/:id/hostesses` | ✅ admin_up | Agent's hostesses |
| GET | `/agents/:id/commissions` | ✅ admin_up | Commission history |

### `agencyReconciliation.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/agency-reconciliation` | ✅ admin_up | Reconciliation report |

---

## Category: Finance

### `invoices.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/invoices` | ✅ manager_up | List invoices |
| GET | `/invoices/:id` | ✅ manager_up | Invoice detail |
| POST | `/invoices/:id/pdf` | ✅ manager_up | Generate PDF |

### `payments-api.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments` | ✅ manager_up | Record payment |
| GET | `/payments` | ✅ manager_up | Payment list |

### `ledger.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/ledger/my` | ✅ staff_roles | Own ledger entries |
| GET | `/ledger/accounts` | ✅ admin_up | Chart of accounts |
| GET | `/ledger/entries` | ✅ admin_up | Ledger entries |

### `receipts.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/receipts` | ✅ manager_up | List receipts |
| GET | `/receipts/:id` | ✅ manager_up | Receipt detail + PDF |

### `folio.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/folio/:reservationId` | ✅ manager_up | Reservation folio |
| POST | `/folio/:reservationId/items` | ✅ manager_up | Add folio item |

### `reports.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/revenue` | ✅ manager_up | Revenue by branch/period |
| GET | `/reports/daily` | ✅ manager_up | Daily revenue breakdown |
| GET | `/reports/occupancy` | ✅ manager_up | Room occupancy |
| GET | `/reports/commissions` | ✅ manager_up | Commission summary |
| GET | `/reports/profit-loss` | ✅ manager_up | P&L statement |

---

## Category: Investor

### `investor.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/investor/dashboard` | ✅ investor+ | Dashboard summary (aggregated) |
| GET | `/investor/revenue` | ✅ investor+ | Revenue chart data |
| GET | `/investor/reports` | ✅ investor+ | Monthly P&L reports |
| POST | `/investor/reports/:id/export` | ✅ investor+ | Export PDF → writes `investor_export_logs` |

### `shareholders.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/shareholders` | ✅ admin_up | List shareholders |
| GET | `/shareholders/:id` | ✅ admin_up | Shareholder detail |
| POST | `/shareholders` | ✅ admin_up | Create shareholder |
| PUT | `/shareholders/:id` | ✅ admin_up | Update shareholder |
| POST | `/shareholders/:id/branch-allocations` | ✅ admin_up | Set branch allocation |

---

## Category: Management & Settings

### `branches.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/branches` | ✅ | List branches |
| POST | `/branches` | ✅ admin_up | Create branch |
| GET | `/branches/:id` | ✅ | Branch detail |
| PUT | `/branches/:id` | ✅ admin_up | Update branch |

### `products.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | ✅ manager_up | List products |
| POST | `/products` | ✅ admin_up | Create product |
| GET | `/products/:id` | ✅ manager_up | Product detail |
| PUT | `/products/:id` | ✅ admin_up | Update product |
| DELETE | `/products/:id` | ✅ admin_up | Delete product |

### `settings-menu-config.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/settings/menu-config/categories` | ✅ admin_up | Menu categories |
| POST | `/settings/menu-config/categories` | ✅ admin_up | Create category |
| PUT | `/settings/menu-config/categories/:id` | ✅ admin_up | Update category |
| DELETE | `/settings/menu-config/categories/:id` | ✅ admin_up | Delete category |
| GET | `/settings/menu-config/audit-log` | ✅ admin_up | Config change log |

### `admin/users.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | ✅ super_admin | List all users |
| POST | `/admin/users` | ✅ super_admin | Create user |
| GET | `/admin/users/:id` | ✅ super_admin | User detail |
| PUT | `/admin/users/:id` | ✅ super_admin | Update user |
| DELETE | `/admin/users/:id` | ✅ super_admin | Delete user |

### `profile.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile/me` | ✅ all | Own profile |
| PATCH | `/profile/me` | ✅ all | Update own profile |

### `dashboards.ts` / `manager.ts` / `driver.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboards/*` | ✅ role-specific | Role-specific dashboard data |
| GET | `/manager/*` | ✅ manager_up | Manager dashboard metrics |
| GET | `/driver/*` | ✅ driver | Driver task list |

### `currency.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/fx-rates` | ✅ | Current FX rates |
| POST | `/fx-rates/convert` | ✅ | Currency conversion |

### `health.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | ❌ | Health check → `{ status: "ok" }` |

### `webhooks.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/webhooks/whatsapp` | ❌ | WhatsApp webhook verify |
| POST | `/webhooks/whatsapp` | ❌ | WhatsApp message handler |
| POST | `/webhooks/telegram` | ❌ | Telegram bot handler |

---

## Audit Log Side Effects

Routes that write to audit tables (must not be removed):

| Route | Audit Table |
|---|---|
| All user management | `audit_log` |
| Menu config changes | `menu_config_audit_log` |
| Special order flags | `special_order_audit` |
| Investor PDF export | `investor_export_logs` |
