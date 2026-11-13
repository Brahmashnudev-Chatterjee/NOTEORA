# Financial calculations - Phase D

Updated 2026-11-13. MongoDB is the marketplace source of truth. This describes implemented development accounting, not tax advice, payment authorisation or production readiness.

## Authoritative inputs

`server/src/services/financialService.ts` calculates immutable version-2 snapshots. `money.ts` parses decimal strings to integer INR paise; BigInt intermediates prevent binary floating-point arithmetic. Values outside safe integer bounds or with excess decimal places are rejected. Legacy rupee fields are display compatibility fields only.

The versioned `PlanPolicy` catalog supplies commission basis points. A seller's verified active subscription contract supplies its saved terms; later catalog edits do not rewrite that contract. Material prices come from MongoDB, not request totals. Each material costs at most INR 150. One eligible promotion per item is applied on the backend. Invalid, expired or another seller's promotion is rejected.

`FinancialPolicy` supplies tax and gateway-fee rules. **Both default to UNRESOLVED.** Quotes expose a subtotal but no final amount; checkout/order creation fails closed until an authorised SUPER_ADMIN records an explicit approved policy, approval reference and audit reason. Setting NONE is an explicit approved business decision, not the default. No actual production policy was configured during this work.

## Rates and unresolved business decisions

The PDF's approximate commission examples are standardised as Free 30%, Pro 20%, Ultra 10% in initial catalog version 1. Prices are INR 199 and INR 499 per calendar-month term. These are project defaults, not externally established commercial rates. Versioned administrative changes are audited and require an expected version.

No GST rate is inferred from the PDF. The engine supports one approved tax component: NONE, EXCLUSIVE or INCLUSIVE. A chartered accountant and legal adviser must determine actual GST incidence/base, marketplace liability, seller registration, commission/service taxes, invoicing, TCS/TDS, refund credits and settlement treatment. Multi-component tax and statutory invoice generation are not implemented. A provider agreement must determine fee rates and fee refunds. The modeled gateway fee is platform-borne; this assumption also needs business approval.

## Calculation and rounding

1. Parse each database price into paise; apply validated discounts before tax and commission.
2. Calculate approved exclusive tax on the discounted base, or extract included tax from the discounted customer amount. Round half up using integer rational arithmetic.
3. Commission = rounded tax-exclusive discounted item base times the seller contract's basis points / 10000. Seller payable = base minus commission.
4. Calculate the configured order gateway fee. Allocate discounts and fees deterministically with largest remainders, preserving exact order totals.
5. Platform net = commission minus gateway fee for material sales. Subscription receipts are separate platform revenue. Tax remains a distinct liability component.

For material orders, **customer payment = seller payable + platform net + gateway fee + tax**. Platform net may be negative if configured fees exceed revenue; it is not clamped to hide losses. Client rendering uses integer money formatting. No browser-supplied total, commission or PAID state is authoritative.

## Multi-seller ledger and adjustments

Snapshots retain every line's material, seller, price, discount, commission and policy version, plus a canonical SHA-256 hash. The signed sandbox payment path validates event evidence, amount, currency and environment, then atomically records the event, order, one ledger per seller containing all that seller's lines, subscription activation where applicable, and audit record. Replay hashes must agree. The unique seller/order key prevents duplicate postings. Conflicting legacy or tampered ledgers fail instead of being overwritten.

Refund adjustments are append-only, unique by order/reference/line, and bounded by the original line. Cumulative proportional reversals avoid rounding drift over multiple refunds. Tax, commission and seller earnings reverse together; gateway fees reverse only when an explicit confirmed fee refund is supplied. Concurrent over-refunds fail transactionally. The internal `applyConfirmedRefund` seam requires trusted confirmation evidence and has **no public/admin execution endpoint**. Tests supply fixture confirmations; no actual refund was requested or reported successful. Provider refund and payout workflows remain later phases.

## Reconciliation example (test fixtures only)

See [machine-readable evidence](docs/evidence/phase-d/reconciliation.json). Seller A has INR 100 with a 10% discount and INR 50 at Free commission; seller B has INR 100 at Pro commission. Explicit test-only NONE tax and hypothetical 1% + INR 0.01 gateway fee produce:

| Component | Paise |
|---|---:|
| Original subtotal | 25000 |
| Discount | 1000 |
| Customer payment | 24000 |
| Commission | 6200 |
| Seller payable | 17800 |
| Gateway fee | 241 |
| Platform net | 5959 |
| Tax | 0 |

24000 = 17800 + 5959 + 241 + 0. A cumulative INR 30 refund of seller A's discounted first line reverses 900 paise commission and debits seller earnings 2100 paise. These rates demonstrate arithmetic only and are not an approved production tax/fee configuration.

## Reports and historical records

Seller queries are constrained to the authenticated seller. Admin reports distinguish marketplace gross, commission, platform net and subscription receipts. Daily, monthly and yearly periods use independent Asia/Kolkata calendar boundaries and `paidAt`; refund adjustments use their own creation date, including refunds of older orders. Status summaries distinguish stored subscription records from effective account plans.

Only reconciled, accounted version-2 records contribute to certified net amounts. Legacy orders/ledgers are explicitly counted as excluded; old data is neither deleted nor silently recalculated. Corrupt version-2 records block reports with a conflict. Legacy remediation requires verified source evidence and a separately approved migration. Existing historical paid-material access is preserved without certifying the original payment evidence.

## Database requirement

Financial writes and upload quota reservations require MongoDB transactions on a replica set. Standalone MongoDB fails these operations with an explicit 503; there is no unsafe partial-write fallback. `docker-compose.phase-d.yml` describes a separate disposable development replica set; it is not a production migration. PostgreSQL schemas were not changed.
