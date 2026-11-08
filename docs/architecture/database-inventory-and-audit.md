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
- PDF price is restricted to ₹0–₹150.
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
