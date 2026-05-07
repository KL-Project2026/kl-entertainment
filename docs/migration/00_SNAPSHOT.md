# 00 · System Snapshot — Migration Baseline

> Frozen: 2026-05-07  
> Purpose: Authoritative baseline for Railway + Vercel + Supabase migration.

## Runtime Versions

| Component | Version |
|---|---|
| Node.js | 24.13.0 |
| pnpm | 10.26.1 |
| TypeScript | ~5.9.2 |
| PostgreSQL | 16.10 |

## Monorepo Structure

```
workspace/                          ← pnpm workspace root
├── artifacts/
│   ├── api-server/                 ← Express 5 API  (port 8080)
│   └── web-app/                   ← React 19 + Vite 7 SPA
├── lib/
│   ├── db/                        ← Drizzle ORM schema + pg Pool
│   ├── api-spec/                  ← Shared TypeScript types
│   ├── api-zod/                   ← Shared Zod validation schemas
│   └── api-client-react/          ← TanStack Query hooks (generated)
├── docs/migration/                ← This document set
├── .env.example                   ← Environment variable template
└── dev.sh                         ← Local multi-service startup
```

## Authentication

- **Mechanism**: JWT Bearer token (not HTTP-only cookie)
- **Token storage**: Zustand `persist` → `localStorage` key `kl-auth-storage`
- **Token field**: `{ state: { token, user } }` inside `kl-auth-storage`
- **Transport**: `Authorization: Bearer <token>` header on every API call
- **Access token expiry**: `JWT_EXPIRY` env (default `24h`)
- **Refresh token expiry**: `REFRESH_TOKEN_EXPIRY` env (default `30d`)
- **JWT secret**: `JWT_SECRET` env (required in production)

## Real-time (Socket.io)

- **Server**: Socket.io 4.8.3 attached to the Express HTTP server
- **Client**: socket.io-client 4.8.3 in web-app
- **Transport**: WebSocket with polling fallback
- **Rooms**: `branch:<branchId>` (room board / hostess), `investor:<shareholderId>` (live P&L)
- **Full event inventory**: see `04_REALTIME_CONTRACTS.md`

## Build Pipeline

| Stage | Tool | Output |
|---|---|---|
| API dev | `tsx src/index.ts` | In-process, no emit |
| API prod | `esbuild` → CJS | `dist/index.cjs` |
| Web dev | Vite 7 dev server | In-memory |
| Web prod | Vite 7 build | `dist/public/` |

## Currency & Locale

| Setting | Value |
|---|---|
| Default currency | MYR (Malaysian Ringgit) |
| Display locale | en-MY / en-GB |
| Date format | DD/MM/YYYY |
| Tax | SST 6% (Malaysia) — hardcoded, branch-level config planned |
| Number format | 1,234.56 (comma thousands, dot decimal) |

## Key Dependencies (frozen)

### API Server
| Package | Version |
|---|---|
| express | ^5 |
| socket.io | ^4.8.3 |
| jsonwebtoken | ^9.0.3 |
| drizzle-orm | ^0.45.1 |
| bcryptjs | ^3.0.3 |
| multer | ^2.1.1 |
| pdfkit | ^0.18.0 |
| node-cron | ^4.2.1 |
| helmet | installed at migration |
| express-rate-limit | installed at migration |

### Web App
| Package | Version |
|---|---|
| react | 19.1.0 |
| vite | ^7.3.0 |
| wouter | ^3.3.5 |
| zustand | ^5.0.12 |
| @tanstack/react-query | ^5.90.21 |
| recharts | ^2.15.4 |
| socket.io-client | ^4.8.3 |
| i18next | ^25.8.18 |
| tailwindcss | ^4.1.14 |
| framer-motion | 12.35.1 |

## Target Infrastructure

| Service | Platform | Notes |
|---|---|---|
| API Server | Railway | Port 8080, CJS bundle |
| Web App | Vercel | SPA, Wouter rewrite rule |
| Database | Supabase | PostgreSQL 16, pooler port 6543, pgbouncer=true |
| File uploads | Local `uploads/` → Object Storage | Phase 2 concern |
