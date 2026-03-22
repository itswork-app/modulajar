# Referral Growth Engine

## Overview

The Referral Growth Engine enables teacher-to-teacher invitation. Each workspace receives a unique referral code that can be shared via link. When a referred workspace generates their first document, the referrer is rewarded with +5 credits.

## Referral Flow

1. **Share**: Teacher copies their unique link `modulajar.app/r/{CODE}`.
2. **Join**: New teacher signs up through the referral link.
3. **Attach**: The system calls `POST /w/:wid/referral/attach` to record the relationship.
4. **Reward**: When the referred workspace completes their first document generation, `MarkJobDone` atomically grants +5 credits to the referrer via `wallet_ledger`.

## Abuse Prevention

| Rule | Enforcement |
|---|---|
| Self-referral blocked | DB `CHECK` constraint + API validation |
| Duplicate referral ignored | `UNIQUE(referrer, referred)` + `ON CONFLICT DO NOTHING` |
| Reward granted only once | `reward_granted` boolean flag, set atomically in CTE |

## API Endpoints

### `GET /w/:workspaceId/referral`

Returns referral code, link, and total referral count.

### `POST /w/:workspaceId/referral/attach`

Attaches a referral relationship. Requires `{ referral_code }` in body.

## Reward Trigger

The reward is processed atomically inside `core-go/db.MarkJobDone()` using a PostgreSQL CTE that:

1. Updates the job status to `done`
2. Finds and marks unrewarded referrals as `reward_granted = true`
3. Inserts +5 credits into the referrer's `wallet_ledger`

All three steps execute in a single atomic SQL statement—no partial states possible.

## Future Enhancements

- Tiered rewards (e.g., 10th referral bonus)
- Referral leaderboard
- Integration with billing dashboard
