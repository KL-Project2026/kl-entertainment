# 02 · Database Schema Freeze

> 53 tables · PostgreSQL 16.10 · Drizzle ORM  
> ⚠️ Zero column deletions or type changes permitted after this freeze.

## Table Inventory (53)

| # | Table | Rows (seed) | Category |
|---|---|---|---|
| 1 | `organizations` | 1 | Core |
| 2 | `branches` | 2 | Core |
| 3 | `staff` | ~30 | Staff |
| 4 | `attendance` | many | Staff |
| 5 | `staff_schedules` | many | Staff |
| 6 | `payslips` | many | Staff |
| 7 | `rooms` | 12 | Operations |
| 8 | `reservations` | many | Operations |
| 9 | `reservation_hostesses` | many | Operations |
| 10 | `reservation_pickups` | many | Operations |
| 11 | `orders` | many | Operations |
| 12 | `order_items` | many | Operations |
| 13 | `room_tables` | 15 | Operations |
| 14 | `room_table_pricing` | many | Operations |
| 15 | `tables` | 10 | Operations (legacy) |
| 16 | `availability_blocks` | many | Operations |
| 17 | `customers` | many | Customer |
| 18 | `hostess_profiles` | many | Hostess |
| 19 | `hostess_photos` | ~756 | Hostess |
| 20 | `hostess_sessions` | many | Hostess |
| 21 | `hostess_session_assignments` | many | Hostess |
| 22 | `hostess_services` | many | Hostess |
| 23 | `hostess_payouts` | many | Hostess |
| 24 | `agents` | many | Agency |
| 25 | `agent_hostess_contracts` | 202 | Agency |
| 26 | `agent_commissions` | many | Agency |
| 27 | `agent_payouts` | many | Agency |
| 28 | `financial_resolutions` | many | Agency |
| 29 | `products` | many | Catalogue |
| 30 | `product_groups` | many | Catalogue |
| 31 | `product_types` | many | Catalogue |
| 32 | `product_group_branch_overrides` | many | Catalogue |
| 33 | `menu_categories` | many | Catalogue |
| 34 | `menu_items` | many | Catalogue |
| 35 | `invoices` | many | Finance |
| 36 | `payments` | many | Finance |
| 37 | `receipts` | 23 | Finance |
| 38 | `folio_entries` | 28 | Finance |
| 39 | `ledger_accounts` | many | Finance |
| 40 | `ledger_entries` | many | Finance |
| 41 | `expenses` | many | Finance |
| 42 | `fx_rates` | many | Finance |
| 43 | `failed_ledger_queue` | many | Finance |
| 44 | `profit_settlements` | many | Finance |
| 45 | `shareholders` | many | Investor |
| 46 | `branch_shareholders` | many | Investor |
| 47 | `investor_reports` | many | Investor |
| 48 | `investor_export_logs` | many | Investor |
| 49 | `relations` | many | CRM |
| 50 | `audit_log` | many | Audit |
| 51 | `menu_config_audit_log` | many | Audit |
| 52 | `special_order_audit` | many | Audit |
| 53 | `driver_messages` | 21 | Driver |

## Critical FK Chains

### Accounting Chain
```
orders → order_items
orders → folio_entries → ledger_entries → ledger_accounts
invoices → payments → receipts
folio_entries → invoices
```

### Hostess Settlement Chain
```
reservations → reservation_hostesses → hostess_sessions
hostess_sessions → hostess_session_assignments
hostess_sessions → agent_commissions (auto-calculated on session close)
agent_commissions → agent_payouts
agent_payouts → financial_resolutions
hostess_sessions → hostess_payouts
```

### Investor Aggregation Chain
```
reservations + orders → (nightly cron job) → investor_reports
investor_reports → investor_export_logs (on PDF download)
branch_shareholders → shareholders
```
> ⚠️ `investor_reports` is populated ONLY by the nightly cron job (`node-cron`).  
> Direct raw table access by investor role = FORBIDDEN.

### Audit Trail Tables (append-only, no DELETE)
```
audit_log           ← general CRUD operations
menu_config_audit_log ← menu/product config changes
special_order_audit  ← special order flags (NO DELETE rule enforced)
investor_export_logs ← investor PDF downloads
```

## Supabase Migration Notes

- Connection string format: `postgresql://USER:PASS@db.PROJECT.pooler.supabase.com:6543/postgres?pgbouncer=true`
- SSL: self-signed cert → `rejectUnauthorized: false` when `DATABASE_URL` contains `supabase`
- pgBouncer transaction mode: avoid `SET` statements and prepared statements in raw SQL
- Schema already fully created via `prod-data-seed.sql` — run against fresh Supabase DB

## Tables Intentionally NOT Migrated

| Table | Reason |
|---|---|
| (none) | All 53 tables migrate as-is |

> Previously: `agent_invoices` was dropped (0 rows, 0 code refs) on 2026-05-07 before freeze.
