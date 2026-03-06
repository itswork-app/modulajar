# Billing UI v1 (PR-070)

This document outlines the structure, design decisions, and future dependencies for the `Billing` page implemented in PR-070. The goal of this release is to provide an institutional-grade, SaaS-ready "surface" for users to view their credit balances and usage, without yet connecting a live payment gateway.

## Page Structure
The `/billing` route is designed with an "Apple-grade" aesthetic, utilizing clear hierarchies, smooth `framer-motion` animations, and the `lucide-react` icon set. 

It consists of four main sections:
1. **Header & Primary Actions**: The page title, alongside clear "Top Up Kredit" and "Redeem Voucher" CTA buttons.
2. **Current Usage (Summary Cards)**: A visually prominent "Saldo Kredit Saat Ini" card, flanked by secondary metrics ("Modul Dibuat" and "Periode Tagihan").
3. **Static Pricing Packages**: Three clean pricing tiers (10, 50, 200 Token) to set user expectations regarding cost.
4. **Transaction History Table**: A dedicated area for ledgers. Currently renders a polished empty state.

## Data Sources
The primary data source for the summary cards is the workspace-scoped API:
`GET /w/:workspaceId/usage-summary`

- **Saldo Kredit**: Mapped from `credits_remaining`.
- **Modul Dibuat**: Mapped from `documents_generated`.

*Note: No fake transaction history is generated. The transaction table remains empty until real ledger data is available via a future API endpoint.*

## Components Created
To keep the UI modular and maintainable, entry points for purchases and redemptions were abstracted into reusable modal components located in `apps/console-web/components/billing/`:

- **`TopUpModal.tsx`**: Displays the available packages. Selecting a package enables the "Lanjutkan" button. Pressing it currently triggers a placeholder alert.
- **`VoucherModal.tsx`**: A simple input form for voucher codes. Submitting triggers a short loading state before displaying a placeholder message.

## Future Dependencies (PR-071 / PR-072)
To make this UI fully functional, upcoming PRs must address the following backend and integration layers:

1. **Payment Gateway Integration (Xendit)**: Wire the `TopUpModal`'s submit button to a backend endpoint that generates a checkout URL or invoice.
2. **Voucher Validation API**: Implement an endpoint to validate and redeem voucher codes entered in `VoucherModal`.
3. **Transaction Ledger API**: Create an endpoint (e.g., `GET /w/:workspaceId/transactions`) to populate the "Riwayat Transaksi" table, replacing the empty state.
