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
