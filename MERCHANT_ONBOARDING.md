# Merchant Onboarding

Merchants register through `POST /api/v1/merchants/register` with business and owner information. New merchants enter `PENDING` status and owners enter the system with `MERCHANT_OWNER` permissions.

Lifecycle states: `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`.

Administrators list applications, inspect details and approve, reject, suspend or reactivate them. A rejected application requires a reason. Approved is the only status eligible for API credential creation.
