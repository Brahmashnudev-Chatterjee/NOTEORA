-- Development gateway authentication state only. No marketplace cutover.
-- Run through controlled migration deployment; never silently applied at startup.
ALTER TABLE "gateway"."MerchantUser"
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "authFamily" TEXT,
  ADD COLUMN "authExpiresAt" TIMESTAMP(3);
