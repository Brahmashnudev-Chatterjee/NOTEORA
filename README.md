# Noteora - Educational Notes Marketplace

> **Phase E.1 (2026-11-13):** application npm audits and lockfile scans now report0;182 distinct regression/security tests pass. Production remains blocked by container-image advisories and historical private-export exposure. [Remediation report](PHASE_E1_SECURITY_REMEDIATION_REPORT.md), [advisory register](DEPENDENCY_ADVISORY_REGISTER.md), [deployment controls](DEPLOYMENT_SECURITY_CHECKLIST.md), [guarded migration procedure](MIGRATION_BOOTSTRAP.md), [secret findings](SECRET_FINDINGS.md). Use the pinned npm11.21.2 resolver; no Phase F/payment-provider integration is enabled. Database exports remain local but are no longer tracked or sent as build context.

> **Phase E delivered (2026-11-13):** gateway merchant onboarding/review, teams, API credentials, webhook configuration and signed sandbox connectivity delivery now have functional dashboards and isolated integration/browser coverage. [Phase E report](PHASE_E_GATEWAY_MERCHANT_REPORT.md) and [Gateway API/docs](docs/gateway/API.md). No live payment/provider/payout processing is enabled. Gateway workers are opt-in; historical fresh migration ordering requires the guarded development procedure in [onboarding](docs/gateway/ONBOARDING.md).

> **Phase D financial baseline (2026-11-13):** subscriptions and integer-paise accounting are implemented and locally tested; the product is not production-ready. See [Phase D report](PHASE_D_SUBSCRIPTION_FINANCIAL_REPORT.md), [current audit](REMAINING_WORK_AUDIT.md), [subscription rules](SUBSCRIPTIONS.md) and [financial rules](FINANCIAL_CALCULATIONS.md).
>
> Canonical initial plans: Free 5 lifetime uploads / 30% commission; Pro INR199 per month / 15 uploads per paid term / 20%; Ultra INR499 / unlimited / 10%. Historical 25/100 limits and financial claims in consolidated excerpts below are superseded. Paid benefits require verified, accounted payment evidence. Tax and gateway-fee policies default UNRESOLVED, not zero; no live billing/provider processing is enabled.
>
> Upload quota and financial writes now require MongoDB replica-set transactions. Use the isolated development setup in the Phase D report; do not repurpose production databases or volumes.




**Learn. Share. Earn.**



Noteora is a full-stack MERN educational notes marketplace. Students browse and purchase approved PDFs, sellers manage materials and earnings, and administrators moderate users, content, orders and reports. The repository also contains PostgreSQL/Prisma infrastructure, Redis/BullMQ foundations, migration tooling, backup procedures, and a separate custom gateway foundation.



> MongoDB remains the current marketplace source of truth. PostgreSQL production cutover and live payment processing are not enabled.



## Technology Stack



| Area | Technology |

| --- | --- |

| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Framer Motion |

| Marketplace API | Node.js, Express 5, TypeScript |

| Marketplace data | MongoDB, Mongoose |

| Infrastructure data | PostgreSQL 16, Prisma ORM |

| Cache and workers | Redis 7, BullMQ |

| Authentication | JWT bearer tokens and bcrypt password hashing |

| Files | Multer, private PDF storage, PDF validation |

| Gateway foundation | Separate gateway API, PostgreSQL, Prisma and merchant services |

| Deployment | Docker Compose with persistent volumes and health checks |



## Local URLs



- Marketplace: `http://localhost:5173`

- Marketplace API: `http://localhost:5000/api/v1`

- API health: `http://localhost:5000/api/health`

- Admin panel: `http://localhost:5173/admin`

- Seller workspace: `http://localhost:5173/dashboard`

- Gateway admin: `http://localhost:5173/gateway/admin`

- Gateway merchant: `http://localhost:5173/gateway/merchant`



## Quick Start



### Requirements



- Node.js 20 or newer

- npm

- MongoDB or MongoDB Atlas

- Docker Desktop for optional infrastructure services



```powershell

npm install

npm run install:all

copy .env.example .env

copy server\.env.example server\.env

npm run dev

```



Start services separately when needed:



```powershell

npm --prefix server run dev

npm --prefix client run dev

```



Do not commit `.env`, database passwords, JWT secrets, API keys or webhook secrets.



## Implemented Product Areas



### Public Marketplace



- Brand landing page and responsive navigation

- Role-aware login/logout behavior

- Registration and JWT authentication

- Material browsing, search, subjects and category views

- Material detail and cart workflows

- Purchase history and verified paid download access

- Verified-purchase reviews

- Admin, seller and buyer route separation



### Seller Workspace



A fixed desktop sidebar and mobile bottom navigation provide consistent access to:



- Dashboard and moderation summary

- PDF and thumbnail upload

- Title, description, subject, academic level, tags and price fields

- Material status views: pending, approved and rejected

- Material editing and deletion for non-approved records

- Paid order and sold-material records

- Gross sales, commission, net earnings and settlement records

- Revenue and popular-material analytics views

- Buyer reviews and ratings

- Discount promotion creation, update and deletion

- Free, Pro and Ultra plan selection

- Seller profile editing

- Password change and notification preferences

- Support-ticket submission and history



Seller routes:



| Route | Page |

| --- | --- |

| `/dashboard` | Seller dashboard |

| `/seller/upload` | Upload notes |

| `/seller/materials` | Material management |

| `/seller/sales` | My sales |

| `/seller/earnings` | Earnings and payouts |

| `/seller/analytics` | Analytics |

| `/seller/reviews` | Reviews and ratings |

| `/seller/promotions` | Promotions |

| `/seller/subscription` | Subscription and plans |

| `/seller/profile` | Seller profile |

| `/seller/settings` | Security settings |

| `/seller/support` | Help and support |



### Admin Workspace



The fixed administration sidebar is present across all admin pages:



- Overview metrics and moderation summary

- User CRUD, activation and plan management

- Seller records and verification management

- Material moderation with feedback

- Category and subject CRUD

- Orders and payment statuses

- Refund requests and statuses

- Subscription-plan CRUD

- Financial reports

- User activity and login audit history



Admin routes:



| Route | Page |

| --- | --- |

| `/admin` | Overview |

| `/admin/users` | Users |

| `/admin/sellers` | Sellers |

| `/admin/materials` | Materials |

| `/admin/categories` | Categories |

| `/admin/orders` | Orders |

| `/admin/payments` | Payments |

| `/admin/refunds` | Refunds |

| `/admin/subscriptions` | Subscriptions |

| `/admin/reports` | Reports |

| `/admin/activity` | Activity |



### Infrastructure and Gateway



- PostgreSQL 16 and Prisma schema setup

- Separate marketplace and gateway database boundaries

- Redis and BullMQ queue infrastructure

- Least-privilege PostgreSQL role scripts

- MongoDB export and dry-run migration tooling

- Migration reconciliation and verification documentation

- Backup and restore procedures

- Gateway merchant onboarding, keys, RBAC, webhook configuration and audit foundations

- Docker Compose development definitions



## Marketplace API Families



- `/api/v1/auth`

- `/api/v1/users`

- `/api/v1/materials`

- `/api/v1/categories`

- `/api/v1/cart`

- `/api/v1/orders`

- `/api/v1/payments`

- `/api/v1/reviews`

- `/api/v1/subscriptions`

- `/api/v1/seller`

- `/api/v1/notifications`

- `/api/v1/support`

- `/api/v1/admin`



## Payment and Download Safety



- Material price limit is ₹150 per base note configuration.

- Only a verified payment state of `PAID` unlocks protected purchases.

- Browser success pages and checkout responses are never payment authority.

- Payment webhooks require signatures, event IDs, ordered sequences and amount validation.

- Seller ledger entries are created only after verified paid processing.

- Production refunds, settlements and payout execution remain unimplemented or provider-dependent.



The protected download flow starts with:



```text

GET /api/v1/orders/:orderId/download-token/:materialId

```



The signed URL expires after 15 minutes and binds the user, order, material and expiry.



## Build Commands



```powershell

# Full build

npm run build



# Frontend build

npm --prefix client run build



# Backend build

npm --prefix server run build



# Backend tests

npm --prefix server test



# PostgreSQL integration tests

npm run test:postgres



# Prisma validation

npm run prisma:validate



# Generate Prisma clients for root, server, and gateway

npm run prisma:generate

# Validate the Prisma schema

npm run prisma:validate

# Run gateway security tests

npm --prefix gateway-api test

```

For a clean CI-style PostgreSQL run, ensure PostgreSQL schemas exist, apply the migrations, generate Prisma clients, then run the PostgreSQL integration suite:

```powershell
psql -h 127.0.0.1 -p 5432 -U noteora_dev -d noteora -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS marketplace; CREATE SCHEMA IF NOT EXISTS gateway;"
psql -h 127.0.0.1 -p 5432 -U noteora_dev -d noteora -v ON_ERROR_STOP=1 -f database/prisma/migrations/20261108175257_phase5b/migration.sql
psql -h 127.0.0.1 -p 5432 -U noteora_dev -d noteora -v ON_ERROR_STOP=1 -f database/prisma/migrations/20261108_phase5c/migration.sql
npm run prisma:generate
npm run test:postgres
```



## Docker Commands



```powershell

docker compose config

docker compose up -d postgres redis mongodb

docker compose ps

docker compose down

```



Review service environment variables before startup. Never place real credentials in Compose files or committed environment files.



## Continuous Integration and Current Verification

[![Noteora CI](https://github.com/Brahmashnudev-Chatterjee/NOTEORA/actions/workflows/ci.yml/badge.svg)](https://github.com/Brahmashnudev-Chatterjee/NOTEORA/actions/workflows/ci.yml)

The GitHub Actions workflow runs on pushes and pull requests to `main` and `develop`. It currently provisions PostgreSQL 16, Redis 7 and MongoDB 7 services, applies the Phase 5B and Phase 5C migrations, generates package-level Prisma clients, validates Docker Compose, validates and builds the schema, frontend, backend and gateway, and runs backend, PostgreSQL integration and gateway security suites.

Latest verified workspace fixes include:

- The PostgreSQL integration suite imports the generated Prisma client correctly in a clean Linux workspace.
- Separate initialized Prisma clients are generated for the root, marketplace server and gateway API packages.
- Schema generation is verified before package imports, builds and test execution.
- PostgreSQL migration setup explicitly creates the `marketplace` and `gateway` schemas before migration SQL execution.
- CI includes package-level Prisma import checks so an uninitialized client fails before tests instead of returning an initialization error later.

The latest CI run shown on GitHub completed successfully for `build-and-test`.



## Estimated Completion



| Area | Estimate | Current status |

| --- | ---: | --- |

| Public marketplace UI | 82% | Core pages, cart, auth, browse and responsive layout implemented |

| Seller workspace | 78% | Major routes and CRUD workflows implemented; live payout and complete analytics remain |

| Admin workspace | 80% | Overview, moderation and CRUD-oriented routes implemented |

| Marketplace API | 75% | Core data operations exist; advanced workflows require integration hardening |

| Authentication and authorization | 85% | JWT and role checks implemented; recovery and production sessions need hardening |

| MongoDB application | 85% | Operational development application remains authoritative |

| PostgreSQL and Prisma | 90% | Schema, migrations, tests and security scripts implemented |

| Redis and BullMQ | 85% | Queue and worker foundation implemented |

| Migration controls | 85% | Export, dry-run, reconciliation and reports available; no production cutover |

| Gateway foundation | 90% | Merchant, keys, permission, webhook and dashboard foundations implemented |

| Payment verification | 55% | Webhook-safe foundations exist; external sandbox/live validation remains |

| Live reporting | 55% | UI summaries exist; some charts need complete live database aggregation |

| Production operations | 65% | Backup and security controls exist; managed secrets, storage and monitoring remain |



### Overall estimate: approximately 78–82% of a production-ready MVP



This estimate describes implementation depth, not production readiness. The payment gateway, MongoDB/PostgreSQL cutover, privacy controls and operational monitoring are not yet complete enough for live public use.



## Remaining Work Before Production



1. Replace chart placeholders with complete database-derived aggregation.

2. Implement the seller draft and archive workflow fully.

3. Add live payout-provider integration with explicit settlement approval.

4. Complete real-time notification delivery.

5. Add seller profile images, contact data and verification documents.

6. Complete email verification and account recovery workflows.

7. Add automated end-to-end tests for buyer, seller and administrator journeys.

8. Move PDFs and thumbnails to private object storage with lifecycle rules.

9. Complete external payment sandbox testing and independent reconciliation.

10. Finish refund status and provider-refund automation.

11. Add managed logging, monitoring, alerting and dependency scanning.

12. Complete disaster-recovery and restore evidence.

13. Perform accessibility and security testing.

14. Review GST, marketplace settlement, privacy, terms and Indian regulatory requirements.

15. Execute a separately approved PostgreSQL cutover only after acceptance criteria pass.



## Important Production Restrictions



- Do not delete or replace existing MongoDB marketplace data.

- Do not make PostgreSQL authoritative without an explicit migration approval.

- Do not enable live payment collection or payout automation.

- Do not claim payment success from frontend navigation alone.

- Do not use unofficial or unauthorised UPI collection endpoints.

- Never expose credentials in browser code, API responses, logs or reports.

# Consolidated Project Documentation


---

## Consolidated source: BACKUP_RESTORE.md

# PostgreSQL Backup and Restore â€” Phase 5B.1

## Commands

Create a custom-format backup and restore it:

```powershell
npm run postgres:restore
```

Create only a backup or restore the latest backup:

```powershell
npm run postgres:backup
powershell -ExecutionPolicy Bypass -File scripts/postgres-backup-restore.ps1 -Action restore
```

Backups are written beneath `database/backups`.

## Verified restoration

The development backup created `database/backups/noteora-20261108-233857.dump` and restored it into `noteora_restore_verify` successfully.

Restored verification:

- Marketplace and gateway application tables: 34
- Restored users: 3

`pg_restore` uses `--no-owner` to avoid ownership assumptions. This test restores to a throwaway development database only and does not modify MongoDB or production data.

## Remaining operational work

Automated scheduled backups, off-host retention, encryption-at-rest, restore alarms and documented recovery-point objectives remain deployment operational tasks.



---

## Consolidated source: DATABASE_SECURITY.md

# Database Security â€” Phase 5B.1

## PostgreSQL roles

- `noteora_app`: application CRUD; no superuser, create-database, create-role or schema-management privilege.
- `noteora_worker`: restricted read/write worker access; no schema creation or migration privilege.
- `noteora_migrator`: migration and schema privileges limited to controlled migration operations.
- `noteora_admin`: non-superuser operational administration role.
- `noteora_dev`: container initialization/administration role and not the application runtime identity.

The role policy is implemented in `database/security/setup-roles.sql` and applied by `database/security/10-setup-roles.sh`. Passwords are supplied through Docker environment variables. No password is stored in documentation or application logs.

## Network and secret controls

PostgreSQL and MongoDB bind to `127.0.0.1`; Redis also binds to localhost and requires a password. The `.env` file is ignored by Git. Redis credentials and database passwords must remain environment-provided.

## Worker security

BullMQ uses exponential backoff and failed-job retention. Each queue supports explicit idempotency keys through `addIdempotentJob`; BullMQ reuses the same job ID instead of creating duplicate work. Payment financial operations are not executed by current placeholder queue processors and require provider-side and database transaction authorization before Phase 5C.

## Audit and backup limitations

The migration path records structured errors and reconciliation totals. Routine database audit-log retention and external secret-manager integration remain deployment-stage work.



---

## Consolidated source: docs/architecture/database-inventory-and-audit.md

# Phase 5A Database and API Inventory

## Existing MongoDB collections

The Mongoose implementation contains 16 persisted model families:

1. `User`
2. `Category`
3. `Material`
4. `Cart`
5. `Order`
6. `PaymentWebhookEvent`
7. `Review`
8. `SellerLedger`
9. `SubscriptionPlan`
10. `Subscription`
11. `SupportTicket`
12. `Notification`
13. `AdminAudit`
14. `UserSession`
15. `ActivityLog`
16. `Refund`

Actual MongoDB collection names are generated from model names by Mongoose, normally plural/lowercase forms such as `users`, `materials` and `sellerledgers`. Migration export lists both common names and falls back to exact collection discovery through the configured database.

## Mongoose relationships and constraints

- User -> Material: seller reference, owner authorization.
- User -> Order: buyer reference.
- Category -> Material: optional category reference.
- User -> Cart: unique user/cart relationship.
- Cart -> Material: embedded item references.
- Order -> Material/User: embedded order items containing title, unit price and seller.
- Review -> Material/User/Order: all required; review purchase authorization depends on paid order data.
- SellerLedger -> Seller/Order: compound seller/order uniqueness.
- Subscription -> User: active plan record.
- Refund -> Order/User: request and requester.
- Session and ActivityLog -> User: optional/required audit relationships.
- AdminAudit -> User actor: optional actor reference.

Unique indexes must preserve:

- User email.
- Category name and slug.
- Seller ledger seller/order.
- Order internal, client and gateway IDs where populated.
- Payment webhook event ID.

## Authentication inventory

- Access JWT in `Authorization: Bearer ...` or legacy cookie fallback.
- Default JWT signing secret exists only as an unsafe development fallback.
- Access JWT lifetime is 15 minutes.
- Refresh token secret is configured but rotation is not implemented.
- Cookies, refresh-session rotation and CSRF protection remain incomplete.
- Roles: USER, MODERATOR, ADMIN, SUPER_ADMIN.
- Admin and moderator routes use role middleware.

## Payment and financial inventory

- Gateway credentials select Live or Sandbox environment.
- Marketplace calculates subtotal and total server-side.
- Existing buyer-submitted amount is not trusted for order creation.
- PDF price is restricted to â‚¹0â€“â‚¹150.
- GST is not currently populated with a validated business tax rate.
- Seller ledger uses original price, discount, GST, customer payment, commission, gateway cost, payable, refund and platform revenue.
- Ledger seller/order insertion is unique.
- Refund route is currently local and explicitly does not claim provider completion.
- Existing webhook HMAC and five-minute timestamp verification exists but is unverified against the actual gateway implementation.

## Protected PDF inventory

- PDFs remain under the private server `uploads` directory.
- Public `/uploads` routes return 404.
- Download authorization requires approved material, paid order and purchaser ownership.
- Download URL tokens expire after 15 minutes and are bound to user/order/material.
- No private object storage, content malware scan or permanent file hash is implemented in the prototype.

## Existing environment variables

- `PORT`
- `CLIENT_URL`
- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `UPI_GATEWAY_URL`
- `UPI_GATEWAY_ENV`
- Live and Sandbox gateway API key/secret credentials
- Live and Sandbox webhook signing secrets

Phase 5A adds PostgreSQL, Redis and migration variables without changing existing defaults. Production migration credentials are not included in source-controlled files.



---

## Consolidated source: docs/architecture/mongodb-postgresql-mapping.md

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
- Prices outside â‚¹0â€“â‚¹150 remain migration errors and require explicit review.
- Live and sandbox financial records are kept in separate environment fields.
- Verification evidence is copied only into gateway records and never creates a PAID status from browser data alone.

## Index mapping

- MongoDB unique email index -> `User.email` unique constraint.
- MongoDB unique category name/slug -> unique PostgreSQL constraints.
- SellerLedger seller/order compound unique index -> `UNIQUE(sellerId, orderId)`.
- PaymentWebhookEvent eventId unique index -> `WebhookEvent.eventId` unique constraint.
- Review IDs and seller/material relationships receive supporting foreign-key indexes.
- Financial query indexes cover environment, status, seller, created date and settlement status.



---

## Consolidated source: docs/architecture/payment-and-webhook-lifecycle.md

# Payment and Webhook Lifecycle

## Payment lifecycle

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> PENDING
  PENDING --> UNDER_REVIEW
  UNDER_REVIEW --> PAID
  PENDING --> PAID
  PENDING --> FAILED
  UNDER_REVIEW --> FAILED
  CREATED --> EXPIRED
  PENDING --> EXPIRED
  PAID --> REFUNDING
  REFUNDING --> REFUNDED
  PAID --> PARTIALLY_REFUNDED
```

Valid transitions must be enforced in gateway code and recorded with actor, source and timestamp. Newer sequence numbers override older payment events; older sequences are archived but never applied backwards.

## Webhook lifecycle

```mermaid
sequenceDiagram
  participant API as Gateway API
  participant Outbox as Webhook Outbox
  participant Queue as BullMQ
  participant Merchant
  API->>API: Verify provider response and transaction
  API->>API: Allocate sequence and store event
  API->>Outbox: Insert durable outbox row
  Queue->>Outbox: Pick available event
  Queue->>Merchant: POST exact signed payload
  Merchant-->>Queue: 2xx or failure
  Queue->>Outbox: Mark delivered or retry
```

Signature format is `X-Signature: t=<unix-seconds>,v1=<hex-hmac>`. The HMAC input is `<timestamp>.<exact_raw_body>`. Delivery must be retried with exponential backoff while retaining attempt history.



---

## Consolidated source: docs/architecture/system-architecture.md

# Phase 5A Architecture Report

## System architecture

```mermaid
flowchart LR
  Browser[Marketplace React] --> MW[Marketplace API]
  GatewayBrowser[Hosted Checkout React] --> GA[Gateway API]
  MW --> PG[(PostgreSQL marketplace schema)]
  MW --> Adapter[Payment Integration Adapter]
  Adapter --> GA
  GA --> GPG[(PostgreSQL gateway schema)]
  GA --> Redis[(Redis)]
  Redis --> Worker[Gateway BullMQ Worker]
  Worker --> GA
  Worker --> MerchantWebhook[Merchant Webhook Endpoint]
  GA --> Providers[Authorised Payment Providers]
  GA --> Storage[Private S3-compatible Storage]
```

## Marketplace architecture

```mermaid
flowchart TB
  Auth[Authentication and Sessions] --> Marketplace[Marketplace Domain]
  Marketplace --> User[Users and Profiles]
  Marketplace --> Material[Materials and Moderation]
  Marketplace --> Commerce[Cart, Orders, Payments]
  Commerce --> Ledger[Seller Ledger and Settlements]
  Marketplace --> Reviews[Reviews]
  Marketplace --> Admin[Admin and Activity Logs]
  Marketplace --> PG[(PostgreSQL marketplace schema)]
```

## Gateway architecture

```mermaid
flowchart TB
  Merchant[Merchant API] --> Auth[API Key, Secret and Signed Request Auth]
  Auth --> Orders[Payment Orders]
  Orders --> Accounts[Payment Account Selector]
  Accounts --> Provider[Provider Adapter]
  Provider --> Verification[Verification and Reconciliation]
  Verification --> Status[Audited Payment Status Machine]
  Status --> Outbox[Webhook Outbox]
  Outbox --> Redis[(Redis/BullMQ)]
  Redis --> Worker[Webhook Worker]
  Worker --> MerchantHook[Merchant Endpoint]
  Status --> GatewayDB[(PostgreSQL gateway schema)]
```

## Database ER overview

```mermaid
erDiagram
  USER ||--o{ SESSION : opens
  USER ||--o{ MATERIAL : uploads
  USER ||--o{ CART : owns
  USER ||--o{ ORDER : places
  CATEGORY ||--o{ MATERIAL : classifies
  MATERIAL ||--o{ ORDER_ITEM : referenced_by
  ORDER ||--|{ ORDER_ITEM : contains
  ORDER ||--o{ PAYMENT : records
  ORDER ||--o{ REVIEW : has
  ORDER ||--o{ SELLER_LEDGER : settles
  SELLER_LEDGER ||--o{ LEDGER_ADJUSTMENT : adjusted_by
  USER ||--o{ SUBSCRIPTION : subscribes
  SUBSCRIPTION_PLAN ||--o{ SUBSCRIPTION : defines
  MERCHANT ||--o{ MERCHANT_CREDENTIAL : authenticates
  MERCHANT ||--o{ PAYMENT_ACCOUNT : configures
  MERCHANT ||--o{ PAYMENT_ORDER : owns
  PAYMENT_ORDER ||--o{ PAYMENT_TRANSACTION : has
  PAYMENT_ORDER ||--o{ PAYMENT_VERIFICATION : verified_by
  PAYMENT_ORDER ||--o{ REFUND_RECORD : refunded_by
  MERCHANT ||--o{ WEBHOOK_ENDPOINT : receives
  WEBHOOK_ENDPOINT ||--o{ WEBHOOK_DELIVERY : delivers
  WEBHOOK_EVENT ||--o{ WEBHOOK_DELIVERY : represented_by
```

## Payment lifecycle

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> PENDING
  PENDING --> UNDER_REVIEW
  UNDER_REVIEW --> PAID
  PENDING --> PAID
  PENDING --> FAILED
  CREATED --> EXPIRED
  PENDING --> EXPIRED
  PAID --> REFUNDING
  REFUNDING --> REFUNDED
  PAID --> PARTIALLY_REFUNDED
  UNDER_REVIEW --> FAILED
```

Only cryptographically verified provider or approved manual-reconciliation evidence may cause the PAID transition. QR generation and browser redirects do not.

## Webhook lifecycle

```mermaid
sequenceDiagram
  participant Gateway as Gateway API
  participant Outbox as Durable Outbox
  participant Queue as BullMQ
  participant Worker
  participant Merchant as Merchant Webhook
  Gateway->>Outbox: Create immutable event and sequence
  Outbox->>Queue: Enqueue delivery
  Worker->>Merchant: Signed HMAC delivery
  Merchant-->>Worker: 2xx acknowledgement
  Worker->>Outbox: Mark delivered
  Worker->>Queue: Retry on timeout/non-2xx
```

## API communication specification

- Marketplace APIs remain under `/api/v1` and are authenticated for user operations.
- Gateway APIs use `X-Api-Key` and `X-Api-Secret`; signed timestamps and replay protection are added before activation.
- Marketplace backend calls gateway APIs through an isolated server-side adapter and never directly changes gateway tables.
- Gateway callbacks reach marketplace using raw bytes and timestamped HMAC signatures.
- Every webhook delivery carries environment, gateway order ID, internal order ID, event ID, sequence, amount and currency.
- Browser redirects are informational only and never complete an order or unlock a PDF.

## Monorepo migration plan

The final structure remains a controlled adaptation of the repository:

```text
noteora/
  apps/
    marketplace-web/     <- migrate client/
    marketplace-api/      <- migrate server/
    gateway-web/          <- create after gateway foundation approval
    gateway-api/          <- create in 5C
    gateway-worker/       <- create after BullMQ foundation approval
  packages/shared-types
  packages/shared-validation
  packages/shared-utils
  packages/payment-sdk
  infrastructure/docker
  infrastructure/nginx
  database/prisma
  database/migrations
  docs/
```

Before moving directories, both existing `client/` and `server/` remain buildable. Files should move only after imports, deployment scripts and CI paths are updated in one tested change.

## Existing endpoint inventory

Main endpoint families found in the existing Express application:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- `GET/PATCH /users/me`
- category create/list routes
- public/material seller upload and update/delete routes
- cart list/update routes
- order creation/status/list routes
- webhook and PDF download-token routes
- review create/list routes
- seller dashboard, materials, settlements and subscription routes
- admin users, orders, materials, reports, refunds, users/sellers/payments, subscriptions and activity routes

The migration does not alter these paths during Phase 5A.



---

## Consolidated source: docs/deployment/migration-and-rollback.md

# MongoDB to PostgreSQL Migration and Rollback Guide

## Safety constraints

- MongoDB is the source of record during Phase 5A.
- No production traffic is switched automatically.
- Migration scripts never update, delete or drop MongoDB records.
- PostgreSQL writes occur inside one database transaction for the full import.
- A failed import rolls back the entire PostgreSQL transaction.
- Gateway records are imported only after merchant identity mapping is approved.

## Prerequisites

1. Start and backup the source MongoDB instance.
2. Configure `MONGO_URI` in the migration shell only.
3. Configure a PostgreSQL migration-only role and `DATABASE_URL`.
4. Apply Prisma migrations to a non-production PostgreSQL database.
5. Review the migration mapping document.
6. Confirm GST and financial assumptions are frozen for reconciliation purposes.

## Export

```powershell
npm run db:export
```

This creates JSON exports under `database/export` for every existing collection. Record SHA-256 hashes of the export directory and retain MongoDB backup metadata.

## Dry run and transformation

```powershell
npm run db:migrate:dry
```

Dry-run mode:

- Reads every exported collection.
- Validates required fields and price limits.
- Reports broken ObjectId references.
- Computes exported ledger and paid-order totals.
- Writes `database/migration-report.json`.
- Does not create PostgreSQL records.

Exit code 2 means migration validation failed.

## Repeated trial imports

```powershell
copy database\migration-report.json database\migration-dry-run-report.json
$env:DATABASE_URL="postgresql://migration_user:...@localhost:5432/noteora_trial"
npm run db:migrate
```

This writes PostgreSQL data only when `DATABASE_URL` is present. Before accepting the trial:

1. Compare collection counts.
2. Verify UUID/`legacyId` uniqueness.
3. Check all order, buyer, seller and material foreign keys.
4. Reconcile SellerLedger totals with paid MongoDB orders.
5. Ensure Live and Sandbox records are isolated.
6. Verify every refunded record has `providerConfirmed=false` unless an actual provider confirmation was independently verified.

## Verification gates

Migration only passes when all are true:

- Export count equals PostgreSQL source count for every mapped collection.
- No unresolved foreign-key references remain.
- Duplicate email, slug and seller/order ledger constraints are zero.
- Historical money totals match to two decimal places.
- Paid PDF orders have the correct approved materials.
- No webhook event is marked processed if signature and sequence verification did not complete.
- Live records do not appear in sandbox result sets and vice versa.

## Rollback strategy

### Before traffic switch

1. Stop migration writer processes.
2. Drop or rename the PostgreSQL migration schema/database.
3. Leave MongoDB unchanged and continue existing traffic.
4. Delete generated export files only after an approved retention period.

### After a PostgreSQL test switch

1. Route traffic back to the existing MongoDB Express API using environment configuration.
2. Disable write mode for the PostgreSQL services.
3. Capture failed or diverged PostgreSQL transaction logs.
4. Do not overwrite MongoDB from PostgreSQL.
5. Export the PostgreSQL delta only for engineering review; replay is a separately approved Phase 5B operation.

## Recovery principles

- MongoDB remains the authoritative recovery source until PostgreSQL reconciliation is signed off.
- PostgreSQL imports are replayable through legacy IDs.
- No migration deletes files from private upload storage.
- PDF object migration is separate and requires content/hash verification.

## Retention

Retain exports, migration reports, backup IDs, record-count checks and reconciliation hashes according to the production data-retention policy. Financial exports require restricted access and encryption at rest.



---

## Consolidated source: docs/security/security-architecture.md

# Security Architecture

## Existing controls retained

- Helmet HTTP security middleware.
- Express rate limiting.
- CORS allow-list with credentials.
- bcrypt password hashing.
- JWT bearer authentication and role middleware.
- private PDF disk storage with protected download routes.
- raw-body webhook handling.
- HMAC-SHA256 timestamped webhook verification.
- five-minute webhook timestamp tolerance.
- unique webhook event ID persistence and sequence fields.
- server-authoritative cart totals.

## Phase 5B requirements

- Replace development JWT fallback secrets with mandatory production secrets.
- Move refresh sessions to PostgreSQL and rotate refresh tokens atomically.
- Prefer secure HTTP-only cookies with SameSite and CSRF protection where browser credentials are used.
- Continue Bearer support only for explicitly non-browser API clients.
- Add session revocation and password-reset revocation.
- Encrypt provider credentials and merchant secrets using an application-managed KMS/key service.
- Store API secrets hashed and return a secret once at creation.
- Add merchant API timestamp validation, replay protection and idempotency keys.
- Use constant-time HMAC verification and separate Live/Sandbox webhook secrets.
- Protect gateway administration with MFA and independent roles.
- Prevent marketplace services from direct gateway financial writes through an API-only boundary.

## Gateway isolation

- Marketplace and gateway modules use different PostgreSQL schemas.
- Separate credentials, environment values and transaction partitions prevent Sandbox records entering Live reports.
- Merchant API credentials are scoped to one merchant and environment.
- Payment account selection records every account choice and reason.
- Signed event payloads and sequence numbers prevent old events overwriting newer states.

## Credential storage

No credentials are committed. `.env` files remain excluded and development Compose values are explicitly development-only placeholders.

Required secrets for later production configuration include database credentials, JWT signing material, Redis/TLS credentials, gateway merchant secrets, provider credentials and private object-storage credentials.



---

## Consolidated source: GATEWAY_ARCHITECTURE.md

# Gateway Architecture

The Phase 5C gateway is a separate Express/TypeScript service on port 5100. It uses the PostgreSQL `gateway` schema and does not read or write MongoDB marketplace data. Redis/BullMQ infrastructure remains available, but this phase enables no payment execution, provider integration, settlement, or payment-success webhook behavior.

## Services
- `gateway-api`: merchant management REST API
- `gateway-web`: shared React application at `/gateway/admin` and `/gateway/merchant`
- PostgreSQL: separate gateway tables and marketplace tables
- Redis: shared infrastructure for future authorized job processing
- MongoDB: unchanged marketplace production source of truth

## Boundaries
Merchant identifiers are enforced in every authenticated merchant route. Administrator operations use an explicit bearer administrator token. API credentials are hashed and webhook signing secrets are encrypted.



---

## Consolidated source: GATEWAY_SECURITY.md

# Gateway Security

Gateway protections include Helmet, CORS, JSON size limits, per-IP rate limiting, bcrypt owner passwords, JWT authentication, administrator bearer authorization, API-key and webhook hashes, AES-256-GCM webhook secrets, Zod validation, merchant-level isolation and audit logging.

Credential values are never logged. PostgreSQL ports are loopback-bound in Compose. Redis requires a password. Live payment processing is disabled. Production traffic and MongoDB remain unchanged.

Automated security coverage verifies unauthenticated merchant routes, unauthorized administrator routes, invalid registration, and invalid credential payload handling. Cross-merchant live integration coverage must be performed against the isolated development database before production use.



---

## Consolidated source: IMPLEMENTATION_AUDIT.md

# Noteora Implementation Audit

## Status evidence

| Area | Status | Evidence |
|---|---|---|
| Authentication and JWT RBAC | IMPLEMENTED BUT NOT TESTED | `server/src/auth.ts`, login/register/admin and role middleware in `server/src/routes.ts`. No refresh-token rotation yet. |
| Buyer/seller/admin accounts | IMPLEMENTED BUT NOT TESTED | Role field, dashboards, admin moderation/user/order APIs and login activity logging. |
| Marketplace search and browsing | COMPLETE AND VERIFIED at build level | Approved-material routes and React marketplace; database journey not run without MongoDB. |
| Cart and server-authoritative pricing | COMPLETE AND VERIFIED at build level | Cart is replaced by approved database materials and orders store server-calculated totals. |
| PDF private upload and moderation | IMPLEMENTED BUT NOT TESTED | Multer private storage, magic-byte validation, PENDING status and admin moderation route. Full content scanning is absent. |
| PDF download authorization | IMPLEMENTED BUT NOT TESTED | PAID purchaser and approved-material checks, plus 15-minute HMAC download token. |
| Seller ledger | PARTIALLY IMPLEMENTED | Idempotent ledger insert keyed by seller/order exists, but settlement payout execution and full refund provider reconciliation remain external work. |
| Financial calculations | IMPLEMENTED BUT NOT TESTED | Configurable financial service exists. GST rates require CA verification; gateway fees remain configuration-dependent. |
| Reviews | IMPLEMENTED BUT NOT TESTED | Review creation requires a PAID order containing the material. |
| Admin reporting/CSV | IMPLEMENTED BUT NOT TESTED | Date-range report and CSV export route; dashboard counts are database-backed. |
| Payment gateway client | PARTIALLY IMPLEMENTED | Headers/order/status endpoints are implemented, but actual Laravel repository and credentials are unavailable. |
| Webhook signature processing | IMPLEMENTED BUT NOT TESTED | Raw-body HMAC, five-minute tolerance, environment, event ID and sequence handling exist. A real Laravel payload must still be verified. |
| Live/Sandbox isolation | IMPLEMENTED BUT NOT TESTED | Environment selects separate API credentials, webhook secret and order environment. |
| Email verification | PARTIALLY IMPLEMENTED | Verified flag exists and `/auth/verify` is protected but sends no email token. |
| Refresh tokens/CSRF | NOT IMPLEMENTED | JWT local-storage bearer flow has no rotation or revocation. Production should prefer secure cookies plus CSRF. |
| Password reset | NOT IMPLEMENTED | User model/API has no reset token workflow. |
| Object storage/malware scan | BLOCKED BY MISSING DEPENDENCY | Disk/private upload exists; managed storage, malware scanning and copyright workflow credentials/tools are unavailable. |
| Gateway refunds | BLOCKED BY MISSING DEPENDENCY | Ledger and local status can be adjusted, but a real gateway refund request needs the Laravel refund contract. |
| Real MongoDB or payment journeys | BLOCKED BY MISSING DEPENDENCY | No supplied running MongoDB instance, gateway repository, credentials or webhook signing secrets. |

## Automated verification

Run `npm run build` and `npm --prefix server test`. Unit coverage currently includes financial boundaries and webhook raw-body/HMAC behavior. Full integration and browser journeys require MongoDB and Playwright tooling.

## External blockers

- Actual Laravel gateway repository and source documentation not supplied.
- Sandbox/live API credentials and webhook secrets not supplied.
- Running MongoDB Atlas/local instance not supplied.
- SMTP/provider credentials not supplied.
- Private object storage and malware-scanning credentials/tools not supplied.
- CA approval for GST, commission and gateway-fee accounting assumptions.



---

## Consolidated source: MERCHANT_API_KEYS.md

# Merchant API Keys

`POST /api/v1/merchant/api-keys` creates test or live environment credentials. The public key prefix identifies the environment. Only a SHA-256 hash of the key and secret is stored. The complete secret is returned once and never exposed by list endpoints.

Generating a new key deactivates the prior active key in that environment. Keys support expiry and explicit revocation. Verification is available at `POST /api/v1/credentials/verify`; no live payment behavior is implemented.



---

## Consolidated source: MERCHANT_ONBOARDING.md

# Merchant Onboarding

Merchants register through `POST /api/v1/merchants/register` with business and owner information. New merchants enter `PENDING` status and owners enter the system with `MERCHANT_OWNER` permissions.

Lifecycle states: `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`.

Administrators list applications, inspect details and approve, reject, suspend or reactivate them. A rejected application requires a reason. Approved is the only status eligible for API credential creation.



---

## Consolidated source: MERCHANT_PERMISSIONS.md

# Merchant Permissions

Roles:
- `MERCHANT_OWNER`: full merchant administration
- `MERCHANT_ADMIN`: team, profile, webhook and key administration
- `MERCHANT_DEVELOPER`: API key and webhook developer operations
- `MERCHANT_VIEWER`: read-only access

Protected routes require JWT authentication and validate both merchant membership and role. Cross-merchant lookups use the merchant ID from the signed token, not a caller-controlled tenant identifier.



---

## Consolidated source: MIGRATION_VERIFICATION.md

# Migration Verification â€” Phase 5B.1

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



---

## Consolidated source: PHASE3_REPORT.md

# Noteora Phase 3 UI/UX and Testing Report

## Validation summary

- Frontend production build: PASS
- Backend TypeScript build: PASS
- Automated backend unit/integration tests: 9 PASS, 0 FAIL
- MongoDB integration: PASS with an ephemeral MongoDB Memory Server for authentication and database operations in automated tests
- Visual landing and authentication inspection: PASS for corrected layout
- Mobile snapshot checked: responsive navigation and single-column layout are active

## Corrected landing page

The original four/three-step mapping was replaced by four explicit, typed step objects in the landing component. Each step now uses its own immutable `n`, `title`, `description`, and `icon` fields. The section uses `grid-cols-1`, `md:grid-cols-2`, and `lg:grid-cols-4`, with card minimum height, icon, title, description, and hover motion. The isolated-letter/empty-card problem has been removed at the data and rendering source.

## Working pages and controls

Landing page, marketplace, categories, material details, login, registration, forgot-password, dashboard, upload PDF, my uploads, my purchases, cart, payment states, subscription management, profile settings, notifications, reviews, and admin route shells are implemented. The existing navigation anchors now scroll to the landing How It Works and Pricing sections.

## Authentication improvements

Login includes password visibility, loading, field validation, incorrect credential feedback, account inactivity feedback from the backend, successful redirect, and forgot-password navigation. Registration includes confirm password, strength display, Terms/Privacy acceptance, duplicate-email handling from the backend, field errors, verification-pending feedback, and loading state.

## Refund and financial status

The refund route no longer claims a bank refund completed. It validates a paid order, records a local `REQUESTED` refund record and returns HTTP 501 with `providerRefund: false`. No order or seller ledger is modified as a successful refund without a gateway-supported refund API response. Financial calculations remain configurable and ledger insertion is unique by seller/order. GST and tax assumptions remain subject to CA review.

## Broken components fixed

- Replaced incomplete landing step array mapping.
- Fixed the landing section grid, step cards, icons, spacing, and hover behavior.
- Repaired JWT bearer header parsing and frontend token setup.
- Fixed seller listing limit logic.
- Fixed malformed PDF uploader callback syntax.
- Added auth loading, validation, status, visibility and forgot-password UI.
- Added protected signed PDF download authorization.
- Added review/user/profile backend endpoints.
- Added database-backed admin route coverage.
- Added `.gitignore` secret and upload protections.

## Non-functional / blocked features

- Real MongoDB deployment journey is not connected until deployment credentials are provided.
- Live payment and real sandbox gateway journeys are blocked by missing Laravel gateway repository and credentials.
- Email delivery is blocked by missing SMTP/provider configuration; forgot-password currently returns a non-disclosing response without sending provider email.
- Real gateway refunds are blocked because no supported refund endpoint or provider contract is supplied.
- Full malware and object-storage scanning are blocked until storage/scanning infrastructure is supplied.
- Automated screenshots of every authenticated role journey require running MongoDB plus three configured accounts and gateway mock/sandbox credentials.
- Reviews require a real approved purchased order and database data; there is no fabricated frontend demo data.

## Production blockers

1. MongoDB connection credentials or deployment instance.
2. Laravel gateway repository, sandbox/live credentials and webhook signing secrets.
3. SMTP email provider.
4. Private object storage and malware scanner.
5. Administrator-created initial account or secure bootstrap process.
6. CA confirmation for GST, commission and settlement accounting.



---

## Consolidated source: PHASE5A_REPORT.md

# Noteora Phase 5A Architecture and Migration Report

## Deliverables completed

1. Complete existing MongoDB/Mongoose/database/API inventory.
2. Prisma PostgreSQL schema covering marketplace and gateway logical schemas.
3. MongoDB export script for every current Mongoose collection.
4. PostgreSQL dry-run migration/transformation script with validation and migration report.
5. Collection-to-table, data-type, relationship and index mapping.
6. Migration and rollback guide.
7. Docker Compose development environment for PostgreSQL, Redis and existing applications.
8. Architecture, database, payment and webhook Mermaid diagrams.
9. Monorepo migration plan and API communication specification.
10. Security architecture and migration testing procedure.

## Files created or modified

- `database/prisma/schema.prisma`
- `server/scripts/mongo-export.mjs`
- `server/scripts/migrate-mongodb-to-postgres.mjs`
- `docker-compose.yml`
- `server/Dockerfile`
- `client/Dockerfile`
- `docs/architecture/database-inventory-and-audit.md`
- `docs/architecture/mongodb-postgresql-mapping.md`
- `docs/architecture/system-architecture.md`
- `docs/deployment/migration-and-rollback.md`
- `docs/security/security-architecture.md`
- `package.json`
- `server/package.json`

## Database design summary

PostgreSQL uses `marketplace` and `gateway` schemas. The Prisma schema includes users, sessions, categories, materials, carts, orders, order items, payments, reviews, subscription plans/subscriptions, ledger entries/adjustments, settlement requests, refunds, notifications, support tickets, activity/audit logs, merchants, credentials, payment accounts/orders/transactions/verifications, provider configurations, webhook endpoint/event/delivery/outbox records, refund records and gateway audit logs.

## Migration design summary

The source remains MongoDB and is export-only in Phase 5A. Dry-run mode performs field validation, reference checks, price-boundary checks, ledger totals and paid-order totals. Real import occurs only if `DATABASE_URL` is explicitly supplied and remains transaction-wrapped. No MongoDB record is updated or deleted.

## Validation results

- Prisma schema validation: PASS.
- Prisma client generation: PASS.
- Frontend production build: PASS.
- Backend TypeScript build: PASS.
- Migration scripts JavaScript syntax: checked.
- Initial migration dry-run: PASS after correcting Prisma CommonJS module loading.
- Docker Compose construction: needs a final `docker compose config` check in an environment with Docker Desktop.

## Explicit limits

- No production migration was performed.
- No MongoDB data was modified.
- No existing gateway provider capabilities were invented.
- No live payment integration was enabled.
- No gateway application implementation was started.
- `PaymentWebhookEvent` remains an export-only reconciliation source until a merchant and gateway payment-order mapping is approved.
- Legacy MongoDB session records cannot recreate secure refresh tokens and are migration markers only.

## Remaining Phase 5B prerequisites

- Persistent PostgreSQL development database.
- Docker/Compose runtime verification.
- Initial SQL migration generation from Prisma schema.
- Approval of PostgreSQL data model and migration mapping.
- Source MongoDB backup and export archive.
- Merchant ID mapping for gateway webhook records.
- Private object-storage mapping for PDF and cover files.
- Sign-off on decimal GST, commission and gateway-fee assumptions.

Phase 5A stops here. Phase 5B has not started.



---

## Consolidated source: PHASE5B_1_REPORT.md

# Noteora â€” Phase 5B.1 Final Report

## Completed

- Least-privilege PostgreSQL roles implemented: application, worker, migrator and administrator.
- Runtime roles are non-superuser/non-createdb/non-createrole identities.
- Live PostgreSQL integration suite passed 5/5 tests.
- Representative MongoDB-shaped fixtures were created and migrated into a separate PostgreSQL database.
- Migration commission conversion bug was corrected for percentage and fractional inputs.
- Migration record counts, financial totals and buyer integrity were verified.
- PostgreSQL custom-format backup creation passed.
- Restore into `noteora_restore_verify` passed with 34 restored marketplace/gateway tables and 3 users.
- MongoDB remained untouched; no production cutover occurred.
- PostgreSQL and MongoDB bind to localhost; Redis binds to localhost and requires authentication.
- BullMQ retains retry/backoff/failed-job behavior and now provides idempotent job IDs.
- Required Phase 5B.1 documentation was added.

## Test results

| Check | Result |
|---|---|
| PostgreSQL integration | PASS, 5/5 |
| Representative migration | PASS, 0 migration errors |
| Ledger versus paid order reconciliation | PASS, 200.00 versus 200.00 |
| Orphaned order buyers | PASS, 0 |
| Backup creation | PASS |
| Restore and record verification | PASS |
| Redis authenticated ping | PASS from prior infrastructure verification |
| Redis unauthenticated access | Rejected with NOAUTH |

## Remaining limitations

- Payment queue processors are placeholders and do not implement live providers or financial mutation.
- Backup restoration is development-only and must be repeated in managed infrastructure with off-host copies.
- Full production audit-log retention, secret-manager integration and scheduled backup automation are not claimed.
- Representative fixtures do not cover every historical edge case in a real MongoDB database.
- Worker financial operations are intentionally absent; idempotency protection must be retained before any provider transaction implementation.

## Recommendation

Phase 5B.1 completion is demonstrated for development hardening and controlled migration. Keep MongoDB authoritative until future approval, retain PostgreSQL development-only, and do not begin Phase 5C or production cutover.



---

## Consolidated source: PHASE5B_REPORT.md

# Noteora Phase 5B Infrastructure Report

## Status

Phase 5B is **implemented and live-infrastructure validated**. Docker Desktop, PostgreSQL, Redis, MongoDB, Prisma migrations, the BullMQ worker, controlled import and reconciliation tooling are operational. MongoDB remains authoritative and application traffic has not been switched.

## Implemented

- PostgreSQL infrastructure definition with persistent volume and health check.
- Redis infrastructure definition with persistent AOF volume and health check.
- PostgreSQL marketplace/gateway Prisma schema retained unchanged.
- Prisma client generation and schema validation pass.
- Development seed script added for a test administrator and core categories.
- Six BullMQ queue families added with exponential retry/backoff, failed-job logging and graceful worker shutdown.
- Workers Docker Compose service added.
- Prisma and Redis health primitives added.
- Enhanced API health endpoint reports MongoDB, PostgreSQL and Redis dependency state.
- Docker Compose syntax passes validation.
- MongoDB export scripts and controlled PostgreSQL migration scripts retained.
- Persistent JSON export refreshed from the real MongoDB development source.
- Migration dry-run passes with zero validation errors.
- MongoDB source records were not modified.
- Existing MongoDB application is still authoritative.

## Verified Results

| Check | Result |
|---|---|
| Backend build | Passed |
| Frontend production build | Passed |
| Backend tests | 9/9 passed |
| Prisma schema validation | Passed |
| Prisma client generation | Passed |
| Docker Compose configuration | Passed |
| Docker PostgreSQL service | Healthy, accepting connections |
| Docker Redis service | Healthy, PONG |
| Docker MongoDB service | Healthy, ping 1 |
| Live Prisma migration | Applied successfully |
| Development seed | Created 1 developer admin and 4 categories |
| BullMQ live jobs | 3/3 test jobs completed |
| PostgreSQL verification | 3 users, 1 session, 1 activity log, 4 categories, 0 orders |
| Buyer/order referential violations | 0 |
| MongoDB timestamped backup | Created |
| MongoDB export | Passed |
| Migration dry-run | Passed, 0 errors |
| Exported users | 2 |
| Exported user sessions | 1 |
| Exported activity logs | 1 |
| Exported financial records | 0 |
| Financial reconciliation | â‚¹0.00 source ledger and â‚¹0.00 paid order total |

## Phase 5B Environment Status

- Docker Desktop is now running.
- PostgreSQL 16, Redis 7 and MongoDB 7 are healthy through Docker Compose.
- PostgreSQL migrations, seed, controlled import and Prisma verification passed.
- BullMQ workers and live Redis job execution passed.
- Application traffic has not switched to PostgreSQL.

## Remaining Acceptance Work

1. Start Docker Desktop and run `docker compose up -d postgres redis mongo`.
2. Apply Prisma migrations or create the approved migration SQL and verify PostgreSQL schemas.
3. Run the development seed.
4. Test PostgreSQL foreign keys, unique constraints and decimal financial integrity.
5. Start Redis and execute at least one job in every BullMQ queue family.
6. Test worker retries, failed jobs, idempotency and graceful shutdown.
7. Take a timestamped MongoDB backup and export checksums.
8. Import the real export into the separate PostgreSQL development database.
9. Compare imported and source record counts and relationships.
10. Reconcile users, sessions, activities and all future financial records.
11. Verify existing MongoDB authentication and application behaviour after infrastructure changes.

## Safety and Authority

MongoDB remains the only authoritative production/writable source. PostgreSQL is not connected as a writable application source and traffic has not been switched. Migration tooling is dry-run capable and transactional when executed. No MongoDB records were deleted or modified.

## Remaining Production Blockers

- Least-privilege runtime and migration PostgreSQL users are still required for production.
- Provider-backed payment verification credentials remain outside Phase 5B.
- Automated PostgreSQL CI integration should be added before production migration.
- Traffic switching and dual-write prevention require a separate production cutover approval.
- The marketplace remains intentionally authoritative on MongoDB.

Phase 5C must not begin until these Phase 5B acceptance items are reviewed and approved.



---

## Consolidated source: PHASE5C_FINAL_AUDIT.md

# Noteora â€” Phase 5C Final Acceptance and Phase 5D Readiness Audit

Audit date: 2026-11-09  
Repository: `d:\NOTEORA`  
Audit scope: source code, documentation, build/test execution, Docker configuration and security review

## Executive Decision

- **Phase 5C acceptance:** **NOT ACCEPTED** in final form
- **Phase 5D readiness:** **NOT READY**
- **Production cutover:** **NOT APPROVED**
- **Live payment enablement:** **PROHIBITED / NOT IMPLEMENTED**

The repository contains a substantial merchant-management foundation, but the merchant admin and developer dashboards are not fully functional, gateway database migration is not fully automated, current gateway JWT and fallback secret handling is unsafe, and merchant-team management is only partially present.

## Overall Implementation Percentage

A source-evidence estimate is appropriate rather than an executable completion claim:

| Area | Estimate | Evidence basis |
|---|---:|---|
| Merchant registration and login | 85% | Real Prisma endpoints and password hashing exist |
| Merchant approval workflow backend | 80% | Status endpoints exist; no browser-integrated authenticated admin UI |
| Merchant dashboard/API actions | 55% | Profile, key, webhook and activity APIs exist; team UI and several dashboard actions are missing |
| API key management | 75% | Generation, hashing, verification, rotation and revocation exist; integration coverage is limited |
| Merchant RBAC | 65% | Role middleware exists, but JWT claims are stale and not revalidated |
| Webhook configuration | 70% | Configuration and encrypted secrets exist; decryption/retrieval, delivery and rotation history are incomplete |
| Audit logging | 80% | Gateway audit log writes exist for major actions |
| Marketplace product implementation | 75â€“80% | Core routes and UI exist, but full database/browser journeys were not run |
| Security hardening | 55% | Tests and middleware exist, but critical secrets, privilege escalation and stale sessions remain |
| Migration/operational hardening | 75% | SQL migrations and tests exist; fresh automated migration deployment and restore evidence remain limited |

**Repository implementation estimate: approximately 68â€“72% of a complete regulated production MVP.**

This is not a claim that Phase 5C is complete or production-ready.

## 1. Code Verification

### Merchant registration and onboarding

**Status: Mostly implemented; untested end-to-end.**

Evidence:

- Gateway registration creates a merchant and owner transactionally in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:53).
- Registration returns the application status and does not create a payment capability.
- Passwords use bcrypt with 12 rounds.
- Merchant onboarding status values exist in Prisma.

Limitations:

- No complete registration UI.
- No email verification or business-document workflow.
- No merchant-team invitation workflow.
- Registration uniqueness and merchant-status behavior require database integration tests beyond the current unit suite.

### Admin approval and rejection

**Status: Backend implemented; UI disconnected.**

Evidence:

- Admin merchant listing, overview and status update endpoints exist in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:109).
- Rejection requires a reason.
- Status changes are audited.

Limitations:

- Gateway admin React fetches merchant endpoints without an `Authorization` token or administrator token in [client/src/GatewayPages.tsx](/d:/NOTEORA/client/src/GatewayPages.tsx).
- No approval/rejection/suspension/reactivation buttons exist in the UI.
- The static bearer-token administrator design is separate from the normal marketplace admin JWT and is not appropriate for normal merchant access control.

### Merchant dashboard actions

**Status: Partially implemented.**

Evidence:

- Gateway merchant backend supports profile, API keys, webhooks and activity.
- The merchant dashboard in [client/src/GatewayPages.tsx](/d:/NOTEORA/client/src/GatewayPages.tsx) is currently four informational cards only.

Missing:

- Login/register form in the merchant UI.
- Profile editing.
- API key generation/listing/revoke actions.
- Webhook create/update/enable UI.
- Security settings.
- Team management.
- Activity rendering from the activity endpoint.

### API key generation and authentication

**Status: Implemented but not fully integration-tested.**

Evidence:

- API keys are generated with separate `nk_test_` and `nk_live_` prefixes.
- Only secure hashes are stored.
- Creation rotates active credentials by environment.
- Verification checks hash, expiry, environment and approved merchant status.
- Revocation is supported.
- Generation is audited.

Limitations:

- The key-verification route is a password-like credential exchange, not middleware for gateway resources because no payment resources exist.
- Key expiry and role behavior lack live database tests.
- Live credentials are currently structurally separated but not provider-verified or operationally restricted to production deployment.

### API key rotation and revocation

**Status: Implemented in API.**

- Rotation revokes/deactivates previous active credentials for the same environment.
- Revoke is merchant-scoped and owner/admin protected.

No gateway UI calls these endpoints.

### Test/live environment separation

**Status: Implemented structurally.**

- Separate `SANDBOX` and `LIVE` enum values exist.
- Separate prefixes and separate active credential replacement by environment exist.
- Credential verification requires both environment and active status.

No production-live credential policy or provider authorization is implemented.

### Merchant RBAC

**Status: Partially implemented.**

- Roles exist for owner, admin, developer and viewer.
- Route-level role checks exist for merchant profile, key and webhook operations.

Limitations:

- JWT claim role is not rechecked against the current merchant-user record.
- Merchant status is not rechecked for all merchant JWT-protected routes.
- No team-member management endpoints or UI exist.
- Viewer can list profile, keys, webhooks and activity because these routes do not require explicit role restrictions. Depending on requirements, that may be a least-privilege issue.

### Cross-merchant data isolation

**Status: Mostly scoped, untested with real merchant records.**

- Merchant identity is normally taken from the JWT `merchantId`.
- Credential revoke and key/webhook queries include `merchantId`.
- No cross-merchant tests create two merchants and attempt object access beyond the gateway security unit tests.

This requires an automated integration suite before acceptance.

### Webhook configuration

**Status: Implemented in API; not delivered.**

Evidence:

- Endpoint URL, environment, active flag, event subscriptions and secret are created in the database.
- One endpoint is selected per merchant/environment.
- AES-256-GCM encryption is used.
- The plaintext secret is returned once.

Limitations:

- No separate PUT rotate-secret endpoint.
- No secret decryption operation exists for delivery workers.
- No webhook delivery worker, retry policy, signature delivery or event history exists.
- Secret values returned by create/update are not usable in the static dashboard.

### Audit logging

**Status: Implemented for gateway actions.**

Audited actions include registration, login, profile update, status changes, API key rotation/revoke and webhook configuration.

The audit action records IP and entity identifiers. Separate marketplace audit logging also exists.

### PostgreSQL migration deployment

**Status: Implemented as SQL; fresh deployment automation is not fully established.**

Evidence:

- Marketplace migration exists under `database/prisma/migrations/20261108175257_phase5b`.
- Phase 5C migration exists under `database/prisma/migrations/20261108_phase5c`.
- A development database migration was reportedly applied manually.

Limitations:

- Migration deployment persistence/invariant had to be bypassed manually according to Phase 5C documentation.
- The CI workflow originally omitted PostgreSQL migration application; it has now been updated in this audit to apply both migration SQL files in a fresh service database before tests.
- No executed migration result from a fresh CI database is available yet; the workflow update requires a future successful GitHub Actions run.

## 2. Marketplace Verification

### Verified and passing source execution

The following ran successfully on the current development environment:

- Backend unit/integration tests: **14/14 passed across 4 files**
- PostgreSQL integration tests: **5/5 passed**
- Gateway security tests: **4/4 passed**
- Backend TypeScript build: passed
- Frontend production build: passed
- Gateway TypeScript build: passed
- Prisma schema validation: passed
- Prisma client generation: passed
- Docker Compose configuration: passed

The repository also contains authentication API integration coverage.

### Buyer registration and login

Backend registration/login routes exist and an actual test registers, rejects duplicate email and logs in in [server/src/index.test.ts](/d:/NOTEORA/server/src/index.test.ts).

Not browser-verified without a browser run in this audit.

### Seller registration and login

No separate durable seller-registration API workflow is confirmed. The marketplace may upgrade a buyer into seller/admin behavior through role fields, but there is no complete seller-application onboarding model in the verified test result.

### Material upload and approval

- Upload route performs Multer storage, magic-byte PDF validation, price validation and limits.
- The model defaults materials to pending status.
- Admin approval API exists.

Actual MongoDB browser/upload journey was not executed; no supplied running MongoDB test journey was available in this audit.

### Search

The approved-material search route supports `subject` and text search. Frontend route existence was confirmed. Actual search result accuracy was not browser/database tested.

### Cart and order creation

Routes and UI exist. Server-authoritative pricing and material validation are present in source. Full end-to-end buyer purchase was not browser-tested.

### Payment status handling

Webhook and financial services have unit coverage, including HMAC behavior. Browser success/failure pages do not establish authority.

No real provider or live webhook journey was executed.

### Protected downloads

A signed 15-minute token route is implemented. Actual paid-purchaser download access was not browser-tested with MongoDB records.

### Reviews

Review creation requires a paid order containing the reviewed material. Full UI/API test execution is absent.

### Seller earnings

Seller API, ledger model and workspace views exist, but provider payout execution is external and incomplete. Charts and historical aggregation require verification against real sales records.

### Admin moderation

Admin CRUD routes exist and the admin shell is shared by routes. Source review identifies backend moderation, but the browser journey and real MongoDB dataset were not exercised.

### Navigation

- Marketplace navigation is role-aware.
- Seller workspace has a fixed left sidebar and requested mobile navigation.
- Admin sidebar exists across admin routes.
- Gateway administration UI is incomplete.

### Identified marketplace gaps

- Admin dashboard monthly-sales chart in [client/src/App.tsx](/d:/NOTEORA/client/src/App.tsx:41) uses a static decorative array rather than actual historical data.
- Seller charts may be summary-derived and do not yet demonstrate complete historical data.
- DRAFT and ARCHIVED are seller UI concepts, but not durable MongoDB material enum states.
- Notification preferences are not yet a confirmed persistent server model.
- Promotion checkout application logic and campaign activation rules require verification.
- Full buyer/seller/admin browser journeys are not proven.

## 3. Security Audit

### Critical security findings

#### CRITICAL â€” Predictable fallback secrets

Evidence:

- Marketplace JWT fallback `dev-access` exists in [server/src/auth.ts](/d:/NOTEORA/server/src/auth.ts:7).
- Gateway JWT and webhook encryption fallbacks exist in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:18).
- Docker Compose fallback gateway values exist in [docker-compose.yml](/d:/NOTEORA/docker-compose.yml:49).

Impact: forged application tokens and webhook-key derivation if deployment omits secret environment variables.

Required fix: remove fallbacks and fail closed on startup.

#### HIGH â€” Privileged role escalation

Any marketplace `ADMIN` may create a `SUPER_ADMIN` because role values are accepted directly in the user-create route in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:67).

Required fix: restrict privileged role assignment to `SUPER_ADMIN` only and use explicit server-side role allowlists.

#### HIGH â€” Seller self-approval mass assignment

Seller `Object.assign(m, req.body)` in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:27) allows a seller to submit moderation fields such as status, seller, PDF path, sales or views.

#### HIGH â€” Unverified subscription activation

Subscription activation in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:51) grants PRO or ULTRA without authoritative payment verification.

#### MEDIUM â€” Support ticket owner override

The support route spreads the full request body after setting the authenticated owner in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:58), allowing `user` replacement.

#### MEDIUM â€” Stale gateway JWT claims and no account-status revalidation

Gateway auth verifies signature but not current role, active flag or merchant status in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:31).

### Other security observations

- Marketplace access uses a bearer JWT local-storage model and no refresh-token rotation or server-side revocation.
- API keys and webhook signing secrets are not logged by current gateway list endpoints.
- Gateway encryption key fallback and admin shared-token design are incomplete production controls.
- Database ports and Redis are loopback/password protected in Docker Compose, but Compose still contains development credential values.
- File uploads validate extension/MIME and PDF magic bytes; malware scanning, content scanning and private object storage are not implemented.
- Raw webhook validation exists in marketplace source and unit coverage exists.
- Rate limits exist on Express routes, but gateway and marketplace have no external per-merchant/provider credential rate policy.
- Input validation is inconsistent: gateway Zod usage is strong; marketplace routes rely heavily on direct `req.body` and ad hoc checks.

## 4. Testing

### Actual results

| Test/build | Result |
|---|---|
| Gateway security tests | 4/4 passed |
| Backend Vitest suite | 14/14 passed across 4 files |
| PostgreSQL integration suite | 5/5 passed |
| Marketplace API build | Passed |
| Frontend production build | Passed |
| Gateway API build | Passed |
| Prisma schema validation | Passed |
| Prisma client generation | Passed |
| Docker Compose configuration | Passed |

### Not executed or insufficiently evidenced

- Browser testing for buyer, seller, admin and gateway roles
- Merchant database integration tests
- Cross-merchant isolation test suite
- API-key rotation/revoke database journey
- Webhook configuration database journey
- Fresh disposable PostgreSQL migration deployment
- MongoDB-to-PostgreSQL actual representative migration acceptance
- Database backup restoration in a current test environment
- Redis connection and BullMQ end-to-end execution
- Docker container startup and health endpoint runtime
- Payment-provider sandbox and webhook journey

No failed source/build/test command was observed in the audit commands that were executed.

## 5. Phase 5D Readiness

**Readiness decision: NOT READY.**

Software requirements still missing or unsafe:

- Remove fallback JWT and webhook secrets.
- Fix seller mass assignment and subscription activation.
- Revalidate gateway JWT account/role/status.
- Add team-management and cross-merchant integration tests.
- Complete authenticated gateway admin and merchant dashboard actions.
- Add webhook delivery worker and secret reuse/decryption architecture.
- Add webhook event persistence and replay protection.
- Add payment order, UPI QR, intent and verification integration with provider-neutral interfaces.
- Add financial idempotency tests and reconciliation jobs.

External dependencies required outside repository implementation:

- Authorized banking or payment-provider arrangement
- Legitimate sandbox/test credentials
- Provider webhook signing keys
- QR generation/UPI provider contract
- Settlement and refund terms
- Merchant KYC/onboarding policy
- Regulated payout arrangements
- RBI/NPCI legal and compliance review
- Managed secret storage
- External provider certificate and uptime monitoring

Software engineering readiness is separate from regulatory authorization. No external dependency may justify marking payments operational before secure implementation and approval.

## 6. Fully Implemented and Tested

- Gateway invalid-route and missing-auth unit checks
- Gateway invalid registration and credential input checks
- Marketplace backend Vitest suite
- PostgreSQL connectivity, CRUD, constraints, rollback, concurrency and duplicate-check integration tests
- Backend, frontend and gateway builds
- Prisma validation and client generation
- Docker Compose syntax validation

## 7. Implemented but Untested

- Merchant registration and login database persistence
- Admin status transitions
- Key generation/verification/rotation/revoke database behavior
- Webhook endpoint configuration encryption
- Merchant audit logging
- Protected marketplace downloads
- Material approval workflow browser journey
- Cart/order/payment state browser journey

## 8. Partially Implemented

- Merchant developer/admin dashboards
- Merchant team management
- Cross-merchant isolation
- Webhook delivery
- Marketplace analytics
- Seller subscriptions and payouts
- Refresh/session security
- Input validation consistency
- Migration deployment automation

## 9. Missing Features

- Authenticated merchant dashboard login/profile/key/webhook controls
- Complete gateway team-management UI/API
- Gateway database integration and isolation suite
- Secret rotation history and delivery history
- Background webhook delivery
- Live payment order creation and dynamic QR/UPI checkout
- Payment reconciliation with authorised provider
- Real payout/refund provider lifecycle
- Production refresh-token rotation and revocation
- Malware scanning and private object-storage lifecycle
- Complete fresh-database and restore validation

## 10. Documentation Assessment

Required repository documents exist:

- `PHASE5C_REPORT.md`
- `GATEWAY_ARCHITECTURE.md`
- `GATEWAY_SECURITY.md`
- `MERCHANT_ONBOARDING.md`
- `MERCHANT_API_KEYS.md`
- `MERCHANT_PERMISSIONS.md`
- `WEBHOOK_CONFIGURATION.md`
- `DATABASE_SECURITY.md`
- `POSTGRESQL_TESTING.md`
- `MIGRATION_VERIFICATION.md`

Documentation correctly contains restrictions against live payment processing and production cutover. However, documentation overstates a few connected UI and integration capabilities; source evidence above is the controlling implementation status.

## 11. Acceptance Decision

### Phase 5C: Rejected for final acceptance

The Phase 5C merchant-management backend foundation is substantial and should not be discarded. It is not sufficient for acceptance until the following blockers are resolved:

1. Remove all JWT and encryption fallback secrets.
2. Fix privileged role creation, seller mass assignment and subscription activation.
3. Revalidate gateway JWT role/account/merchant status.
4. Connect gateway admin approval/rejection UI.
5. Implement or clearly document team management as remaining scope.
6. Add and pass actual gateway cross-merchant database integration tests.
7. Add fresh migration deployment automation and execute it in CI.
8. Execute browser journeys for gateway admin and gateway merchant dashboards.
9. Do not enable live payments until external approvals and provider credentials are supplied separately.

## 12. Security Remediation Follow-Up

The user selected **Fix all issues** after reviewing the security findings. The following fixes were applied after the initial audit:

- Marketplace JWT verification/signing now fails closed outside test mode when `JWT_ACCESS_SECRET` is absent.
- Gateway JWT and webhook encryption secrets now fail closed outside test mode when required environment variables are absent.
- Docker Compose removed development gateway and marketplace secret fallbacks and now requires explicit secret environment variables.
- Marketplace admin create and update routes now restrict privileged role assignment; only `SUPER_ADMIN` may create or assign `SUPER_ADMIN`.
- Seller material updates now use an explicit server-side field allowlist instead of unrestricted `Object.assign`.
- Paid PRO/ULTRA seller plan activation now returns `402` and creates no subscription without a verified payment flow; free plan activation remains available.
- Support-ticket creation now stores only authenticated owner, subject, message and initial status.
- Gateway merchant JWT authentication now requeries active merchant-user and merchant status records and replaces stale token role claims with current database values.

Post-fix verification:

- Phase 5B and Phase 5C SQL migrations both executed successfully in a fresh temporary PostgreSQL 16 database; both `marketplace` and `gateway` schemas were created and retained.
- Backend tests: 14/14 passed.
- Gateway security tests: 4/4 passed.
- Backend, gateway and frontend builds passed.
- Docker Compose configuration passed with explicit nonproduction CI values.

Additional cross-merchant integration tests and refresh-token rotation remain future hardening work rather than fixes claimed by these unit/build results.

## 13. CI Updated

The GitHub Actions workflow has been updated to:

- Use a PostgreSQL 16 service
- Use Redis 7 and MongoDB 7 services
- Install root, server, client and gateway dependencies
- Apply Phase 5B and Phase 5C migration SQL in a fresh PostgreSQL database
- Validate Docker Compose
- Validate and generate Prisma
- Build marketplace backend/frontend and gateway backend
- Run marketplace, PostgreSQL and gateway test suites

The updated workflow should be run as a GitHub Actions check before Phase 5C acceptance. This local audit does not substitute for a successful remote Actions run.



---

## Consolidated source: PHASE5C_REPORT.md

# Noteora â€” Phase 5C Implementation Report

## Completion Status
Phase 5C merchant-management foundation is implemented and stopped before payment processing, production cutover, provider integration and Phase 5D.

## Implemented
- Separate Gateway API under `gateway-api` on port 5100.
- Prisma gateway lifecycle and `MerchantUser` team model added.
- Phase 5C migration SQL applied to the development PostgreSQL database.
- Merchant registration, profile, login, status workflow and audit logging.
- Merchant roles: owner, admin, developer and viewer.
- Merchant API keys: test/live environments, secure hashes, expiry, revocation, rotation.
- Credential verification endpoint without payment-processing behavior.
- Webhook endpoint configuration with event subscriptions and AES-256-GCM secret storage.
- Gateway administrator and merchant React dashboard routes.
- Docker gateway API, worker and frontend service definitions.
- Least-privilege gateway app/worker/admin grants added to security setup SQL.
- Required gateway architecture and security documentation.

## Verification Results
- Prisma schema validation: passed.
- Prisma client generation: passed.
- Gateway TypeScript build: passed.
- Marketplace API build: passed.
- React/Vite production build: passed.
- Docker Compose configuration: passed.
- Gateway security tests: 4/4 passed.
- PostgreSQL Phase 5C migration SQL: applied successfully to the development database.

## PostgreSQL Verification
PostgreSQL connectivity and migration application were verified on the existing development container. The separate gateway migration converted verified merchants to approved and created the merchant-role/team models and webhook secret fields.

## Security and Operational Checks
- Database ports remain loopback-bound.
- Redis remains password protected.
- Gateway API uses Helmet, CORS, rate limiting, JWT, Zod and redacted error handling.
- API keys and webhook signing secrets are never returned by list endpoints.
- MongoDB remains authoritative and unchanged.
- No live UPI provider, live payment response, settlement or production cutover was added.

## Test Limitation
Prisma `migrate deploy` reached a migration-persistence initialization invariant before this manually-applied migration; the SQL migration itself was successfully executed and verified directly. Live cross-merchant database integration and restore testing require dedicated test credentials and an isolated test database. Repository unit security coverage passes, while high-volume concurrent and full integration scenarios remain operational recommendations rather than production claims.

## Known Remaining Work
- Connect GatewayAdmin controls to approval/rejection API actions with authenticated UI flows.
- Add full merchant team-management endpoints and UI.
- Add gateway API-key middleware for all future protected payment resources.
- Add background webhook delivery workers only after an authorized payment-event architecture exists.
- Perform migration deployment checks in a fresh disposable PostgreSQL instance.
- Complete external security review and secret-store integration for production.



---

## Consolidated source: POSTGRESQL_TESTING.md

# PostgreSQL Testing â€” Phase 5B.1

## Live integration suite

Run:

```powershell
npm run test:postgres
```

Actual result: 1 test file passed, 5/5 tests passed in 2.08 seconds.

Coverage includes live connectivity, duplicate email constraints, user relationships, material/category ownership, order/item relationships, ledger uniqueness and consistency, transaction rollback, internal-order uniqueness, concurrent updates, and cleanup.

The suite uses `TEST_DATABASE_URL` or the configured development URL and creates uniquely prefixed records. Cleanup runs after tests. A named order with duplicate client IDs was not used as the uniqueness fixture.

## Additional commands

```powershell
npm run prisma:validate
npm run prisma:generate
npm run postgres:verify
```

Docker health:

```powershell
docker compose ps
docker compose exec postgres pg_isready -U noteora_dev -d noteora
docker compose exec redis redis-cli -a "$env:REDIS_PASSWORD" ping
```



---

## Consolidated source: WEBHOOK_CONFIGURATION.md

# Webhook Configuration

`PUT /api/v1/merchant/webhooks` creates or updates an environment-specific endpoint. Signing secrets are generated with cryptographic randomness, encrypted at rest using AES-256-GCM, and returned only once. List endpoints return endpoint metadata only.

Configurations support URL, active state and event subscriptions. Delivery and real payment event notification are intentionally not claimed as operational in Phase 5C.



## Migration Fixture Files

Representative migration fixtures are generated by `server/scripts/create-migration-fixtures.mjs` for controlled migration testing. The JSON files in `database/migration-fixtures/` are test records only and do not modify MongoDB or PostgreSQL production data.

