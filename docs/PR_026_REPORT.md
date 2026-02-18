# PR-026: Payment Webhook Security Hardening Specification

## Overview
Secure the public webhook endpoint `POST /internal/webhooks/payment/confirm` against spoofing, replay attacks, and misuse.

## Implementation Details

### 1. Signature Verification (HMAC SHA256)
- **Method**: Validates `X-Callback-Signature` header against `HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET)`.
- **Timing Safe**: Uses `constantTimeCompare` to prevent timing attacks.
- **Fail-Fast**: Returns `401 Unauthorized` immediately on failure.

### 2. Replay Protection & Deduplication
- **New Table**: `payment_events` tracks processed events by `provider_event_id`.
- **Mechanism**: Incoming events are checked against this table.
- **Behavior**: Duplicate events return `200 OK` (idempotent) but trigger NO new business logic.

### 3. Strict Event Validation
- **Scope**: Only processes `payment.succeeded` events.
- **Ignore**: All other event types (e.g. `payment.failed`, `invoice.created`) are logged and return `200 OK` (ignored) to prevent provider retries.

### 4. Idempotent Ledger Integration
- **Reference**: Uses `provider_event_id` as the unique reference for wallet credit transactions.
- **Guarantee**: Database constraints on `wallet_ledger` prevent double-crediting even in race conditions.

## Verification Report

### Automated Tests (`npm test`)
| Test Case | Expected Outcome | Result |
|-----------|------------------|--------|
| **Valid Signature + Payload** | `200 OK`, Ledger Credited | ✅ PASS |
| **Invalid Signature** | `401 Unauthorized` | ✅ PASS |
| **Replay Attack (Duplicate ID)** | `200 OK`, No Credit (Idempotent) | ✅ PASS |
| **Invalid Event Type** | `200 OK`, Ignored | ✅ PASS |
| **Missing External Ref** | `200 OK` (failed_malformed) | ✅ PASS |
| **Receipt Not Found** | `200 OK` (failed_unknown_ref) | ✅ PASS |
| **Full Regression Suite** | No regressions in existing billing | ✅ PASS |

### Build Status
- `apps/api-ts`: ✅ Build Successful (clean `tsc`)

## Post-Deploy Checklist
1. [ ] Run migration `migrations/006_payment_events.sql`
2. [ ] Set `PAYMENT_WEBHOOK_SECRET` in environment variables.
3. [ ] Notify webhook provider to sign requests with the secret.

## Anti-Retry Policy
To prevent provider retry storms, this endpoint returns `200 OK` for almost all logical failures (e.g., missing params, unknown receipt), flagging them as `failed` in the internal `payment_events` log. The ONLY `4xx` response is `401 Unauthorized` for invalid signatures.
