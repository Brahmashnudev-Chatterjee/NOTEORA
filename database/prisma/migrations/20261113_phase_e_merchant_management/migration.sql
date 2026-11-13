-- Additive gateway-only changes. No marketplace data migration.
ALTER TYPE gateway."MerchantStatus" ADD VALUE IF NOT EXISTS 'DISABLED';
CREATE TABLE gateway."MerchantInvitation" (
 "id" UUID PRIMARY KEY, "merchantId" UUID NOT NULL REFERENCES gateway."Merchant"("id") ON DELETE CASCADE,
 "email" TEXT NOT NULL, "name" TEXT NOT NULL, "role" gateway."MerchantRole" NOT NULL,
 "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
 "acceptedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MerchantInvitation_merchantId_email_idx" ON gateway."MerchantInvitation"("merchantId","email");
ALTER TABLE gateway."WebhookDelivery" ADD COLUMN "leaseUntil" TIMESTAMP(3);
CREATE TABLE gateway."WebhookAttempt" (
 "id" UUID PRIMARY KEY, "deliveryId" UUID NOT NULL REFERENCES gateway."WebhookDelivery"("id") ON DELETE CASCADE,
 "number" INTEGER NOT NULL, "status" TEXT NOT NULL, "responseStatus" INTEGER,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
 UNIQUE("deliveryId","number")
);

-- Append-only security history. The existing FK may detach a deleted merchant,
-- but no action/actor/details/timestamp may be rewritten through normal SQL.
CREATE FUNCTION gateway.protect_audit_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW."merchantId" IS NULL AND OLD."merchantId" IS NOT NULL
    AND (to_jsonb(NEW) - 'merchantId') = (to_jsonb(OLD) - 'merchantId')
    AND NOT EXISTS (SELECT 1 FROM gateway."Merchant" WHERE id = OLD."merchantId") THEN
   RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Gateway audit history is append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER gateway_audit_append_only BEFORE UPDATE OR DELETE ON gateway."GatewayAuditLog"
 FOR EACH ROW EXECUTE FUNCTION gateway.protect_audit_history();
