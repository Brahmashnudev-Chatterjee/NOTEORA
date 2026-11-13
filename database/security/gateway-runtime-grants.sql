-- Run explicitly as a deployment administrator AFTER migrations.
-- Provision these independent login roles/passwords through your secret manager first.
-- No production execution is authorised by Phase E.1.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA gateway, marketplace FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA gateway, marketplace FROM noteora_gateway_api, noteora_gateway_worker;
GRANT USAGE ON SCHEMA gateway TO noteora_gateway_api, noteora_gateway_worker;
GRANT SELECT,INSERT,UPDATE ON gateway."Merchant",gateway."MerchantUser",gateway."MerchantCredential",
 gateway."MerchantInvitation",gateway."WebhookEndpoint",gateway."WebhookEvent",gateway."WebhookDelivery",gateway."WebhookOutbox" TO noteora_gateway_api;
GRANT SELECT ON gateway."WebhookAttempt" TO noteora_gateway_api;
GRANT SELECT,INSERT ON gateway."GatewayAuditLog" TO noteora_gateway_api;
GRANT SELECT ON gateway."Merchant",gateway."WebhookEndpoint",gateway."WebhookEvent" TO noteora_gateway_worker;
GRANT SELECT,UPDATE ON gateway."WebhookDelivery",gateway."WebhookOutbox" TO noteora_gateway_worker;
GRANT SELECT,INSERT,UPDATE ON gateway."WebhookAttempt" TO noteora_gateway_worker;
GRANT SELECT,INSERT ON gateway."GatewayAuditLog" TO noteora_gateway_worker;
-- No DELETE, payment/financial tables, schema CREATE, migration-history or role-admin grants.
-- New tables receive no automatic blanket grants. Re-review after each migration.
