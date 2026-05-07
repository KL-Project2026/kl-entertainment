# 05 · i18n & Locale Freeze

> Frozen baseline for internationalisation. Source of truth: `artifacts/web-app/src/i18n/`

## Supported Languages

| Code | Language | Status |
|---|---|---|
| `en` | English (en-MY / en-GB) | ✅ Primary — complete |
| `zh-Hans` | Simplified Chinese | 🔲 Planned |
| `zh-Hant` | Traditional Chinese | 🔲 Planned |
| `ms` | Bahasa Malaysia | 🔲 Planned |
| `th` | Thai | 🔲 Planned |
| `ko` | Korean | 🔲 Planned |
| `ja` | Japanese | 🔲 Planned |

Currently only `en` locale file is implemented (`src/i18n/locales/en.json`). Other languages are planned for Phase 2 of development.

## i18n Setup

```typescript
// lib: i18next + react-i18next
// Namespace: "translation" (default)
// Fallback language: "en"
// Detection: localStorage → navigator.language → "en"
```

## Currency Format Rules

| Context | Format | Example |
|---|---|---|
| Display (all pages) | `RM #,###.##` | `RM 1,234.56` |
| PDF reports | `MYR #,###.##` | `MYR 1,234.56` |
| Investor reports | Owner currency (configurable) | `USD 334.20` |
| Rounding | 2 decimal places | — |
| Negative | `RM -1,234.56` | — |

```typescript
// Current implementation (lib/utils.ts pattern)
export function formatCurrency(amount: number, currency = "MYR"): string {
  return `RM ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
```

## Date & Time Format Rules

| Context | Format | Example |
|---|---|---|
| Display dates | DD/MM/YYYY | `07/05/2026` |
| Display date+time | DD/MM/YYYY HH:mm | `07/05/2026 22:30` |
| API input/output | ISO 8601 | `2026-05-07T22:30:00+08:00` |
| Korean/Japanese | YYYY-MM-DD | `2026-05-07` |
| Timezone | Asia/Kuala_Lumpur (UTC+8) | — |

## Tax Configuration

| Setting | Value | Notes |
|---|---|---|
| Tax type | SST (Sales and Service Tax) | Malaysia |
| Rate | 6% | Hardcoded in invoice generation |
| Applies to | Room charges + F&B | Excludes hostess service fees |
| Future | Branch-level config | Planned when expanding to Thailand/Singapore |

## Hostess Name Handling

- Names may contain non-Latin characters (Korean, Japanese, Chinese, Thai)
- All name fields are stored as `TEXT` (no varchar length limits that truncate Unicode)
- PDF generation uses PDFKit — ensure font embedding for CJK characters
- Display: full name shown to `manager_up` roles; `hall`/`kitchen`/`general` see family name only

## Translation Key Structure (en.json)

```
nav.*              ← Sidebar navigation labels
auth.*             ← Login / logout
dashboard.*        ← Dashboard titles
reservations.*     ← Reservation management
staff.*            ← Staff management
hostess.*          ← Hostess management
agency.*           ← Agency management
finance.*          ← Finance / invoices
reports.*          ← Reports
investor.*         ← Investor portal
settings.*         ← Settings
profile.*          ← My Profile / My Account
common.*           ← Shared labels (save, cancel, delete, etc.)
```

## Migration Notes

- When adding new locale files, add to `src/i18n/index.ts` resources object
- All user-facing strings MUST have a translation key — no hardcoded English strings in JSX
- Currency formatting must use `formatCurrency()` helper — never raw `toFixed()`
- Dates must use `date-fns` with explicit locale — never `Date.toLocaleDateString()` without locale
