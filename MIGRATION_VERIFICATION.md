# Migration Verification — Phase 5B.1

## Representative fixture verification

Run:

```powershell
npm run migration:fixtures
```

The fixture generator creates users, sellers, categories, materials, orders, buyer purchase history, seller ledger entries, reviews, subscriptions, payment references, refunds, sessions and activity records. The migration target is the separate `noteora_migration_verify` database.

## Actual result

The migration completed with zero migration errors:

- Users: 3
- Materials: 2
- Orders: 3
- Order items: 3
- Reviews: 1
- Subscriptions: 1
- Seller ledger entries: 2
- Payments: 3
- Refund records: 1
- Ledger customer-payment total: 200.00
- Paid-order financial total: 200.00
- Orphaned order buyers: 0

The migration initially exposed commission values stored as percentages. The migration now normalizes values greater than 1 to fractions, while accepting existing fractional rates unchanged.

## Limitations

This verifies representative marketplace scenarios but does not prove every historical data anomaly. Invalid or ambiguous records remain reported by the migration report and are never silently deleted. No MongoDB record is modified by the migration.
