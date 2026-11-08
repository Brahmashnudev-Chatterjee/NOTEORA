# MongoDB to PostgreSQL Mapping

Migration is export-only until PostgreSQL validation passes. MongoDB records are never modified.

| MongoDB collection | Existing Mongo fields | PostgreSQL module/table | Conversion and constraints | Legacy identifier mapping |
|---|---|---|---|---|
| users | `_id`, `name`, `email`, `password`, `role`, `verified`, `active`, `plan`, verification/reset fields, timestamps | marketplace.User | Email lowercase/unique; bcrypt password hash retained as passwordHash; role enum validation; deterministic UUID generated from ObjectId and stored in `legacyId` | `_id` -> `legacyId` and deterministic UUID |
| categories | `_id`, `name`, `slug`, timestamps | marketplace.Category | Slug and name unique; ObjectId references converted deterministically | `_id` -> `legacyId` |
| materials | `_id`, title, description, academicLevel, subject, category, tags, price, seller, pdfPath, coverImage, status, views, sales, moderationNote, timestamps | marketplace.Material | Decimal price; arrays copy; private local paths become `pdfObjectKey/coverObjectKey` placeholders until S3 migration; seller/category foreign keys | `_id` -> `legacyId` |
| carts | `_id`, `user`, `items[].material`, `items[].quantity`, timestamps | marketplace.Cart, marketplace.CartItem | One cart per user; unique cart/material pair | `_id` cart legacy; item IDs deterministic |
| orders | `_id`, internal/client/gateway IDs, user, items, amounts, GST, discount, total, currency, environment, status, sequence, URLs, expiry, paidAt, timestamps | marketplace.Order, marketplace.OrderItem, marketplace.Payment | Decimal money; environment uppercase; status enum; item seller/material foreign references; payment record created from verified gateway values only | `_id` -> `legacyId` |
| paymentwebhookevents | eventId, event, sequence, gatewayOrderId, environment, processedAt, payload, timestamps | gateway.WebhookEvent / gateway.PaymentOrder mapping | Cannot import without merchant ID and payment account mapping; retained in export and reconciled after merchant configuration; eventId remains unique | `eventId` unique; payload preserved |
| reviews | `_id`, material, user, order, rating, comment, reported, helpful, timestamps | marketplace.Review | Rating 1-5 constraint; unique user/material/order combination | `_id` -> `legacyId`; helpful ObjectIds map to UUIDs |
| sellerledgers | `_id`, seller, order, all financial values, settlementStatus, timestamps | marketplace.SellerLedger | Decimal conversions; seller/order unique pair; immutable ledger fields; original values retained for reconciliation | `_id` -> `legacyId` |
| subscriptionplans | `_id`, name, price, activeListings, commissionRate, featured, features, timestamps | marketplace.SubscriptionPlan | Name unique; commission stored Decimal; plan reference added | `_id` -> `legacyId` |
| subscriptions | `_id`, user, plan, expiresAt, active, timestamps | marketplace.Subscription | Historical subscriptions preserved; `planName`; environment copied/validated if known | `_id` -> `legacyId` |
| supporttickets | `_id`, user, subject, message, status, timestamps | marketplace.SupportTicket | Unknown users become nullable; status validation | `_id` -> `legacyId` |
| notifications | `_id`, user, title, message, read, type, timestamps | marketplace.Notification | User foreign key and read index | `_id` -> `legacyId` |
| adminaudits | `_id`, actor, action, entity, entityId, details, IP, timestamps | marketplace.AdminAudit | Actor optional; JSON details remain JSONB | `_id` -> `legacyId` |
| usersessions | `_id`, user, IP, userAgent, login/logout, timestamps | marketplace.Session | Legacy records lack refresh-token hashes; synthetic migration markers must not be treated as active refresh sessions | `_id` -> audit marker |
| activitylogs | `_id`, user, actorRole, action, entity, entityId, details, IP, timestamps | marketplace.ActivityLog | JSON details; optional user; indexes preserved | `_id` -> `legacyId` |
| refunds | `_id`, order, requestedBy, amount, reason, status, timestamps | marketplace.Refund, gateway.RefundRecord | Existing status must remain a request status unless provider confirmation exists; provider-confirmed fields default false | `_id` -> `legacyId` |

## Data conversion rules

- ObjectIds are converted with SHA-256 to deterministic RFC-4122-shaped UUIDs during migration and stored as `legacyId`.
- Money fields use `Decimal(12,2)` and are never migrated as binary floating point.
- Dates use UTC timestamps.
- Email addresses are lowercased after uniqueness validation.
- Empty or malformed references are reported rather than silently discarded.
- Prices outside ₹0–₹150 remain migration errors and require explicit review.
- Live and sandbox financial records are kept in separate environment fields.
- Verification evidence is copied only into gateway records and never creates a PAID status from browser data alone.

## Index mapping

- MongoDB unique email index -> `User.email` unique constraint.
- MongoDB unique category name/slug -> unique PostgreSQL constraints.
- SellerLedger seller/order compound unique index -> `UNIQUE(sellerId, orderId)`.
- PaymentWebhookEvent eventId unique index -> `WebhookEvent.eventId` unique constraint.
- Review IDs and seller/material relationships receive supporting foreign-key indexes.
- Financial query indexes cover environment, status, seller, created date and settlement status.
