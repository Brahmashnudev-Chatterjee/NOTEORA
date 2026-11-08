# Merchant Permissions

Roles:
- `MERCHANT_OWNER`: full merchant administration
- `MERCHANT_ADMIN`: team, profile, webhook and key administration
- `MERCHANT_DEVELOPER`: API key and webhook developer operations
- `MERCHANT_VIEWER`: read-only access

Protected routes require JWT authentication and validate both merchant membership and role. Cross-merchant lookups use the merchant ID from the signed token, not a caller-controlled tenant identifier.
