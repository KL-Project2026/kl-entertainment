# 03 · RBAC Matrix — 10 Roles × API Access

> Frozen baseline. Any new route MUST be added here before merge.

## Role Definitions

| Role | Code | Description |
|---|---|---|
| Super Admin | `super_admin` | Full system access, all orgs |
| Admin | `admin` | Organisation-level admin |
| Branch Manager | `branch_manager` | Single branch full access |
| Manager | `manager` | Operational management |
| Hostess | `hostess` | Own sessions/profile only |
| Driver | `driver` | Pickup/dropoff tasks only |
| Kitchen | `kitchen` | Order view (kitchen display) |
| Hall | `hall` | Hall service tasks |
| General | `general` | General staff (limited) |
| Investor | `investor` | Read-only financial reports |

## Role Hierarchy Constants (frontend)

```typescript
const ADMIN_UP    = ["super_admin", "admin"]
const MANAGER_UP  = ["super_admin", "admin", "branch_manager", "manager"]
const OPS_UP      = ["super_admin", "admin", "branch_manager", "manager", "hostess", "driver", "kitchen", "hall", "general"]
const DASH_ROLES  = ["super_admin", "admin", "branch_manager", "manager"]
const STAFF_ROLES = all 10 roles except "investor"
const ALL_ROLES   = all 10 roles
```

## Golden Rules (Regression Assertions)

1. **Investor isolation**: `investor` role → only `GET /api/investor/*` allowed. All other routes return `403`.
2. **Hostess isolation**: `hostess` → own `hostess_sessions`, `agent_commissions`, profile only.
3. **Driver isolation**: `driver` → pickup/dropoff (`reservation_pickups`) only. Zero finance/hostess access.
4. **PII masking**: `kitchen`, `hall`, `general` → guest phone last 4 digits only, name = family name only.
5. **Audit requirement**: Every new write route MUST write to `audit_log`.
6. **Commission immutability**: `agent_commissions` rows may not be deleted once created.

## Access Matrix

| Route Category | super_admin | admin | branch_manager | manager | hostess | driver | kitchen | hall | general | investor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/logout` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/me` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET/PATCH /api/profile/me` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/ledger/my` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET/POST /api/reservations` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/PUT/DELETE /api/reservations/:id` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/rooms` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/room-board` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET/POST /api/orders` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET/POST /api/staff` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/staff/hostesses` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/POST /api/attendance` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/POST /api/schedules` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/POST /api/agencies` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/POST /api/agents` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/invoices` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/reports/*` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/investor/dashboard` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `GET /api/investor/revenue` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `GET /api/investor/reports` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `GET /api/shareholders` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/branches` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/POST /api/products` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/settings/menu-config/*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET/POST /api/admin/users` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/driver/*` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/hostess-portal/*` | ❌ | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ |

> *hostess: own records only

## Demo Credentials

| Account | Password | Role |
|---|---|---|
| `admin@klproject.com` | `Admin@123!` | `super_admin` |
| `{role}@klproject.com` | `KL@12345!` | matching role |
| `kl01@klproject.com` | `KL@12345!` | `branch_manager` |
| `kl02@klproject.com` | `KL@12345!` | `branch_manager` |
