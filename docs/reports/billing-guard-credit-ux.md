# Billing Guard & Credit UX

*PR-C7 — Last updated: 2026-03-10*

## Credit Indicator (Header)

Always visible in the console header on all dashboard pages.

| Balance | Color | Link |
|---|---|---|
| > 3 tokens | Green | → `/billing` |
| 1–3 tokens | Yellow (amber) | → `/billing` |
| 0 tokens | Red | → `/billing` |

**API:** `GET /w/:id/wallet/summary` → `credits_remaining`

## Wizard Credit Panel

Shown in **Step 4 (Review)** before the generate button.

| State | UI |
|---|---|
| Loading | Neutral/grey badge |
| > 3 credits | Green — "Tersedia", perkiraan biaya 1 token |
| 1–3 credits | Yellow — warning + quick "Isi Ulang" link |
| 0 credits | Red — error block, "Isi Ulang Kredit" CTA, "Lihat Transaksi" |

## Generation Guard

Generate button (`disabled` attribute):
- Disabled when `credits_remaining === 0`
- No server round-trip needed — balance already fetched on load

## Credit Refresh

- Header refetches on workspace change
- Wizard refetches on page load
- After successful generation: wizard routes to `/modules/:id` (no more wizard context)

## Billing Interaction Flow

```
Low/zero credit noticed (header or wizard)
  → Click → /billing
    → Top Up via TopUpModal
    → Credit balance refreshes on next navigation
```

## API Endpoints Used

| Endpoint | Used By |
|---|---|
| `GET /w/:id/wallet/summary` | Header credit badge |
| `GET /w/:id/wallet/summary` | Wizard CreditPanel |
| `GET /w/:id/wallet/transactions` | Billing page transaction list |
