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
