# Subscription management - Phase D

Updated 2026-11-13. Runtime authority is `subscriptionService.ts`: initial defaults, then the latest immutable MongoDB `PlanPolicy` version. All public, buyer, seller and administrator interfaces consume the same API. Old SubscriptionPlan records and README historical excerpts are not runtime policy.

| Plan | Initial monthly price | Upload entitlement | Commission | Premium features |
|---|---:|---|---:|---|
| Free | INR 0 | 5 lifetime creations | 30% | Basic analytics |
| Pro | INR 199 | 15 per paid billing period | 20% | Featured eligibility, advanced financial export |
| Ultra (Ultra Pro label) | INR 499 | Unlimited | 10% | Featured eligibility, advanced financial export |

This resolves the previous 25/100 active-listing defaults in favour of the original plan's approximately 15/unlimited specification. Draft, pending, approved, rejected and archived creations count. Deletion does not restore quota. Counters and creation are one MongoDB transaction; concurrent requests cannot consume the final slot twice. Lifetime counting continues during paid terms. Initial historical usage is reconstructed from existing records only; previously deleted uploads cannot be recovered without external evidence.

## Contract lifecycle

Paid entitlements require an accounted version-2 SUBSCRIPTION order with matching user, PAID status, verified event reference and hash-covered purchased terms. Neither selecting a plan, returning from checkout, setting User.plan, an old active boolean nor an administrator grant activates paid benefits.

Contracts snapshot price, limit, commission, features and catalog version at purchase. UTC calendar-month terms clamp month-end dates. Renewal and upgrades/downgrades queue after the latest verified existing term; they do not prorate or truncate a current term. No trial, credit or automatic debit mechanism is invented. Renewal eligibility is shown during the last seven days of an uncancelled active term; unpaid orders may be prepared earlier but grant nothing.

Expired contracts fall back to current Free terms immediately at request time. Cancellation retains the current benefits through expiry, disables renewal eligibility and records cancellation. Suspension removes paid benefits immediately. A confirmed subscription refund suspends the affected contract. Scheduled contracts become effective only at their own start time. Admin suspend/resume/cancel actions require role checks and audit reasons; they cannot manufacture payment evidence. Cancellation concerns the selected current contract; pre-purchased scheduled contracts remain separately recorded and require explicit business review if a customer wants those cancelled/refunded too.

## Interfaces and restrictions

- `GET /subscriptions/plans`: canonical catalog.
- `GET /subscriptions/me`: effective entitlement, usage and history.
- `POST /subscriptions/orders`: creates an unpaid sandbox order only, subject to approved financial policy.
- `POST /subscriptions/cancel`: cancellation at current term end; no money transfer.
- `PUT /admin/subscription-catalog`: SUPER_ADMIN only, expectedVersion and audit reason required.
- Admin subscription-member actions: suspend/resume/cancel verified contracts; no arbitrary activation or direct entitlement edits.

Upload quotas and premium export/featured permissions are enforced by backend checks. User payloads are presented using effective entitlements instead of trusting stale stored plan labels. Admin catalog edits preserve already purchased terms.

There is no live subscription checkout, recurring collection or provider integration in Phase D. The retained signed sandbox webhook is test/development only and rejects production processing. Actual purchase completion is blocked pending an authorised provider arrangement in a later approved phase. See [financial rules](FINANCIAL_CALCULATIONS.md) and [delivery report](PHASE_D_SUBSCRIPTION_FINANCIAL_REPORT.md).
