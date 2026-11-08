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
