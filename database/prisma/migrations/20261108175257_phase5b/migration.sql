-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "marketplace";
CREATE SCHEMA IF NOT EXISTS "gateway";

-- CreateEnum
CREATE TYPE "marketplace"."UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "marketplace"."MaterialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "marketplace"."PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'UNDER_REVIEW', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "marketplace"."SettlementStatus" AS ENUM ('PENDING', 'READY', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "gateway"."MerchantStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "gateway"."PaymentEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "gateway"."GatewayPaymentStatus" AS ENUM ('CREATED', 'PENDING', 'UNDER_REVIEW', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateTable
CREATE TABLE "marketplace"."User" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "name" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "marketplace"."UserRole" NOT NULL DEFAULT 'USER',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'FREE',
    "verificationTokenHash" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "acceptedTermsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Category" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Material" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "sellerId" UUID NOT NULL,
    "categoryId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academicLevel" TEXT,
    "subject" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DECIMAL(12,2) NOT NULL,
    "pdfObjectKey" TEXT,
    "coverObjectKey" TEXT,
    "status" "marketplace"."MaterialStatus" NOT NULL DEFAULT 'PENDING',
    "views" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Cart" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."CartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Order" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "internalOrderId" TEXT NOT NULL,
    "clientOrderId" TEXT NOT NULL,
    "gatewayOrderId" TEXT,
    "userId" UUID NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "gst" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "environment" "gateway"."PaymentEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "paymentStatus" "marketplace"."PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "gatewayEventSequence" INTEGER NOT NULL DEFAULT 0,
    "paymentUrl" TEXT,
    "upiIntent" TEXT,
    "paymentExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "sellerId" UUID NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Payment" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "orderId" UUID NOT NULL,
    "gatewayOrderId" TEXT,
    "providerReference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "environment" "gateway"."PaymentEnvironment" NOT NULL,
    "status" "gateway"."GatewayPaymentStatus" NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Review" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "materialId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "helpfulUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."SubscriptionPlan" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "name" VARCHAR(20) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "activeListings" INTEGER NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Subscription" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "userId" UUID NOT NULL,
    "planId" UUID,
    "planName" VARCHAR(20) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "environment" "gateway"."PaymentEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."SellerLedger" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "sellerId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "originalPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "gst" DECIMAL(12,2) NOT NULL,
    "customerPayment" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "gatewayCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellerPayable" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platformRevenue" DECIMAL(12,2) NOT NULL,
    "settlementStatus" "marketplace"."SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "immutableHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."LedgerAdjustment" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."SettlementRequest" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "sellerId" UUID NOT NULL,
    "ledgerId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "marketplace"."SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Refund" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "orderId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "providerRefundId" TEXT,
    "providerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."Notification" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."SupportTicket" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "userId" UUID,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."ActivityLog" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "userId" UUID,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."AdminAudit" (
    "id" UUID NOT NULL,
    "legacyId" TEXT,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."Merchant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessName" TEXT,
    "status" "gateway"."MerchantStatus" NOT NULL DEFAULT 'PENDING',
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."MerchantCredential" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "environment" "gateway"."PaymentEnvironment" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecretHash" TEXT NOT NULL,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecretHash" TEXT,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."PaymentAccount" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "merchantIdentifier" TEXT,
    "provider" TEXT NOT NULL,
    "vpa" TEXT,
    "encryptedCredentials" JSONB,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "dailyTransactionLimit" INTEGER,
    "dailyAmountLimit" DECIMAL(12,2),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."PaymentOrder" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "paymentAccountId" UUID,
    "gatewayOrderId" TEXT NOT NULL,
    "clientOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT,
    "environment" "gateway"."PaymentEnvironment" NOT NULL,
    "status" "gateway"."GatewayPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "paymentUrl" TEXT,
    "upiIntent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."PaymentTransaction" (
    "id" UUID NOT NULL,
    "paymentOrderId" UUID NOT NULL,
    "providerReference" TEXT,
    "utr" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "rawResponseHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."PaymentVerification" (
    "id" UUID NOT NULL,
    "paymentOrderId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidence" JSONB,
    "reviewedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."ProviderConfiguration" (
    "id" UUID NOT NULL,
    "merchantId" UUID,
    "environment" "gateway"."PaymentEnvironment" NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."WebhookEndpoint" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "environment" "gateway"."PaymentEnvironment" NOT NULL,
    "url" TEXT NOT NULL,
    "signingSecretHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."WebhookEvent" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "paymentOrderId" UUID,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."WebhookDelivery" (
    "id" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."WebhookOutbox" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."RefundRecord" (
    "id" UUID NOT NULL,
    "paymentOrderId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "providerRefundId" TEXT,
    "providerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway"."GatewayAuditLog" (
    "id" UUID NOT NULL,
    "merchantId" UUID,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_legacyId_key" ON "marketplace"."User"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "marketplace"."User"("email");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "marketplace"."User"("role", "active");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "marketplace"."User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "marketplace"."Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "marketplace"."Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "marketplace"."Session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_legacyId_key" ON "marketplace"."Category"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "marketplace"."Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "marketplace"."Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Material_legacyId_key" ON "marketplace"."Material"("legacyId");

-- CreateIndex
CREATE INDEX "Material_status_createdAt_idx" ON "marketplace"."Material"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Material_sellerId_status_idx" ON "marketplace"."Material"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Material_subject_idx" ON "marketplace"."Material"("subject");

-- CreateIndex
CREATE INDEX "Material_title_idx" ON "marketplace"."Material"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "marketplace"."Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_materialId_key" ON "marketplace"."CartItem"("cartId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_legacyId_key" ON "marketplace"."Order"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_internalOrderId_key" ON "marketplace"."Order"("internalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientOrderId_key" ON "marketplace"."Order"("clientOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_gatewayOrderId_key" ON "marketplace"."Order"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "marketplace"."Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "marketplace"."Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_environment_paymentStatus_idx" ON "marketplace"."Order"("environment", "paymentStatus");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "marketplace"."OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_sellerId_idx" ON "marketplace"."OrderItem"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_legacyId_key" ON "marketplace"."Payment"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayOrderId_key" ON "marketplace"."Payment"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "Payment_status_environment_createdAt_idx" ON "marketplace"."Payment"("status", "environment", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_gatewayOrderId_key" ON "marketplace"."Payment"("orderId", "gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_legacyId_key" ON "marketplace"."Review"("legacyId");

-- CreateIndex
CREATE INDEX "Review_materialId_rating_idx" ON "marketplace"."Review"("materialId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_materialId_orderId_key" ON "marketplace"."Review"("userId", "materialId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_legacyId_key" ON "marketplace"."SubscriptionPlan"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "marketplace"."SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_legacyId_key" ON "marketplace"."Subscription"("legacyId");

-- CreateIndex
CREATE INDEX "Subscription_userId_active_expiresAt_idx" ON "marketplace"."Subscription"("userId", "active", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerLedger_legacyId_key" ON "marketplace"."SellerLedger"("legacyId");

-- CreateIndex
CREATE INDEX "SellerLedger_sellerId_settlementStatus_idx" ON "marketplace"."SellerLedger"("sellerId", "settlementStatus");

-- CreateIndex
CREATE INDEX "SellerLedger_createdAt_idx" ON "marketplace"."SellerLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerLedger_sellerId_orderId_key" ON "marketplace"."SellerLedger"("sellerId", "orderId");

-- CreateIndex
CREATE INDEX "LedgerAdjustment_ledgerId_createdAt_idx" ON "marketplace"."LedgerAdjustment"("ledgerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAdjustment_ledgerId_type_referenceId_key" ON "marketplace"."LedgerAdjustment"("ledgerId", "type", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementRequest_legacyId_key" ON "marketplace"."SettlementRequest"("legacyId");

-- CreateIndex
CREATE INDEX "SettlementRequest_sellerId_status_idx" ON "marketplace"."SettlementRequest"("sellerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_legacyId_key" ON "marketplace"."Refund"("legacyId");

-- CreateIndex
CREATE INDEX "Refund_orderId_status_idx" ON "marketplace"."Refund"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_legacyId_key" ON "marketplace"."Notification"("legacyId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "marketplace"."Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_legacyId_key" ON "marketplace"."SupportTicket"("legacyId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "marketplace"."SupportTicket"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_legacyId_key" ON "marketplace"."ActivityLog"("legacyId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "marketplace"."ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "marketplace"."ActivityLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAudit_legacyId_key" ON "marketplace"."AdminAudit"("legacyId");

-- CreateIndex
CREATE INDEX "AdminAudit_actorId_createdAt_idx" ON "marketplace"."AdminAudit"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "gateway"."Merchant"("slug");

-- CreateIndex
CREATE INDEX "Merchant_status_idx" ON "gateway"."Merchant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCredential_apiKey_key" ON "gateway"."MerchantCredential"("apiKey");

-- CreateIndex
CREATE INDEX "MerchantCredential_merchantId_environment_active_idx" ON "gateway"."MerchantCredential"("merchantId", "environment", "active");

-- CreateIndex
CREATE INDEX "PaymentAccount_merchantId_status_priority_idx" ON "gateway"."PaymentAccount"("merchantId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_gatewayOrderId_key" ON "gateway"."PaymentOrder"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "PaymentOrder_merchantId_environment_status_idx" ON "gateway"."PaymentOrder"("merchantId", "environment", "status");

-- CreateIndex
CREATE INDEX "PaymentOrder_expiresAt_status_idx" ON "gateway"."PaymentOrder"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_merchantId_environment_clientOrderId_key" ON "gateway"."PaymentOrder"("merchantId", "environment", "clientOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentOrderId_createdAt_idx" ON "gateway"."PaymentTransaction"("paymentOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_utr_idx" ON "gateway"."PaymentTransaction"("utr");

-- CreateIndex
CREATE INDEX "PaymentVerification_paymentOrderId_createdAt_idx" ON "gateway"."PaymentVerification"("paymentOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderConfiguration_merchantId_environment_active_idx" ON "gateway"."ProviderConfiguration"("merchantId", "environment", "active");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_merchantId_environment_active_idx" ON "gateway"."WebhookEndpoint"("merchantId", "environment", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_merchantId_environment_url_key" ON "gateway"."WebhookEndpoint"("merchantId", "environment", "url");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "gateway"."WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_createdAt_idx" ON "gateway"."WebhookEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_paymentOrderId_eventType_sequence_key" ON "gateway"."WebhookEvent"("paymentOrderId", "eventType", "sequence");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "gateway"."WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_endpointId_eventId_key" ON "gateway"."WebhookDelivery"("endpointId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookOutbox_eventId_key" ON "gateway"."WebhookOutbox"("eventId");

-- CreateIndex
CREATE INDEX "WebhookOutbox_completedAt_availableAt_idx" ON "gateway"."WebhookOutbox"("completedAt", "availableAt");

-- CreateIndex
CREATE INDEX "RefundRecord_paymentOrderId_status_idx" ON "gateway"."RefundRecord"("paymentOrderId", "status");

-- CreateIndex
CREATE INDEX "GatewayAuditLog_merchantId_createdAt_idx" ON "gateway"."GatewayAuditLog"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "GatewayAuditLog_action_createdAt_idx" ON "gateway"."GatewayAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "marketplace"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Material" ADD CONSTRAINT "Material_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "marketplace"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Material" ADD CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "marketplace"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "marketplace"."Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."CartItem" ADD CONSTRAINT "CartItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "marketplace"."Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."OrderItem" ADD CONSTRAINT "OrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "marketplace"."Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Review" ADD CONSTRAINT "Review_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "marketplace"."Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "marketplace"."SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."SellerLedger" ADD CONSTRAINT "SellerLedger_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "marketplace"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."SellerLedger" ADD CONSTRAINT "SellerLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."LedgerAdjustment" ADD CONSTRAINT "LedgerAdjustment_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "marketplace"."SellerLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."SettlementRequest" ADD CONSTRAINT "SettlementRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "marketplace"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."SettlementRequest" ADD CONSTRAINT "SettlementRequest_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "marketplace"."SellerLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "marketplace"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Refund" ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "marketplace"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "marketplace"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."MerchantCredential" ADD CONSTRAINT "MerchantCredential_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."PaymentAccount" ADD CONSTRAINT "PaymentAccount_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."PaymentOrder" ADD CONSTRAINT "PaymentOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."PaymentOrder" ADD CONSTRAINT "PaymentOrder_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "gateway"."PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "gateway"."PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."PaymentVerification" ADD CONSTRAINT "PaymentVerification_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "gateway"."PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."WebhookEvent" ADD CONSTRAINT "WebhookEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "gateway"."PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "gateway"."WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "gateway"."WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."RefundRecord" ADD CONSTRAINT "RefundRecord_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "gateway"."PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway"."GatewayAuditLog" ADD CONSTRAINT "GatewayAuditLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "gateway"."Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
