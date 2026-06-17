-- =============================================
-- 20260506 - Stripe Subscriptions Schema (Phase 1)
-- =============================================
-- Adds the columns + tables needed to move from one-time payments
-- to real recurring Stripe Subscriptions.
--
-- Plan-level:    StripeProductId, StripeMonthlyPriceId, StripeYearlyPriceId
-- Subscription:  StripeSubscriptionId, CurrentPeriodStart/End, cancel state, default PM
-- New table:     SubscriptionAddOns (used by Phase 4 add-ons; created now to avoid future migration noise)
--
-- Idempotent: safe to re-run.
-- =============================================

SET NOCOUNT ON;

-- ---------------------------------------------
-- 1. Plans: link to Stripe Product + Prices
-- ---------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Plans]') AND name = N'StripeProductId')
BEGIN
    ALTER TABLE [dbo].[Plans] ADD [StripeProductId] NVARCHAR(100) NULL;
    PRINT 'Added Plans.StripeProductId.';
END
ELSE
    PRINT 'Plans.StripeProductId already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Plans]') AND name = N'StripeMonthlyPriceId')
BEGIN
    ALTER TABLE [dbo].[Plans] ADD [StripeMonthlyPriceId] NVARCHAR(100) NULL;
    PRINT 'Added Plans.StripeMonthlyPriceId.';
END
ELSE
    PRINT 'Plans.StripeMonthlyPriceId already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Plans]') AND name = N'StripeYearlyPriceId')
BEGIN
    ALTER TABLE [dbo].[Plans] ADD [StripeYearlyPriceId] NVARCHAR(100) NULL;
    PRINT 'Added Plans.StripeYearlyPriceId.';
END
ELSE
    PRINT 'Plans.StripeYearlyPriceId already exists - skipped.';
GO

-- ---------------------------------------------
-- 2. Subscriptions: Stripe subscription mirroring
-- ---------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]') AND name = N'StripeSubscriptionId')
BEGIN
    ALTER TABLE [dbo].[Subscriptions] ADD [StripeSubscriptionId] NVARCHAR(100) NULL;
    PRINT 'Added Subscriptions.StripeSubscriptionId.';
END
ELSE
    PRINT 'Subscriptions.StripeSubscriptionId already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]') AND name = N'CurrentPeriodStart')
BEGIN
    ALTER TABLE [dbo].[Subscriptions] ADD [CurrentPeriodStart] DATETIME2 NULL;
    PRINT 'Added Subscriptions.CurrentPeriodStart.';
END
ELSE
    PRINT 'Subscriptions.CurrentPeriodStart already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]') AND name = N'CurrentPeriodEnd')
BEGIN
    ALTER TABLE [dbo].[Subscriptions] ADD [CurrentPeriodEnd] DATETIME2 NULL;
    PRINT 'Added Subscriptions.CurrentPeriodEnd.';
END
ELSE
    PRINT 'Subscriptions.CurrentPeriodEnd already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]') AND name = N'CancelAtPeriodEnd')
BEGIN
    ALTER TABLE [dbo].[Subscriptions]
        ADD [CancelAtPeriodEnd] BIT NOT NULL CONSTRAINT [DF_Subscriptions_CancelAtPeriodEnd] DEFAULT (0);
    PRINT 'Added Subscriptions.CancelAtPeriodEnd.';
END
ELSE
    PRINT 'Subscriptions.CancelAtPeriodEnd already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]') AND name = N'CanceledAt')
BEGIN
    ALTER TABLE [dbo].[Subscriptions] ADD [CanceledAt] DATETIME2 NULL;
    PRINT 'Added Subscriptions.CanceledAt.';
END
ELSE
    PRINT 'Subscriptions.CanceledAt already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]') AND name = N'DefaultPaymentMethodId')
BEGIN
    ALTER TABLE [dbo].[Subscriptions] ADD [DefaultPaymentMethodId] NVARCHAR(100) NULL;
    PRINT 'Added Subscriptions.DefaultPaymentMethodId.';
END
ELSE
    PRINT 'Subscriptions.DefaultPaymentMethodId already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Subscriptions_StripeSubId' AND object_id = OBJECT_ID(N'[dbo].[Subscriptions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Subscriptions_StripeSubId]
        ON [dbo].[Subscriptions] ([StripeSubscriptionId])
        WHERE [StripeSubscriptionId] IS NOT NULL;
    PRINT 'Added IX_Subscriptions_StripeSubId.';
END
ELSE
    PRINT 'IX_Subscriptions_StripeSubId already exists - skipped.';
GO

-- ---------------------------------------------
-- 3. SubscriptionAddOns: per-feature add-ons (Phase 4)
-- ---------------------------------------------

IF OBJECT_ID(N'[dbo].[SubscriptionAddOns]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubscriptionAddOns] (
        [Id]                       INT IDENTITY(1,1) NOT NULL,
        [SubscriptionId]           INT               NOT NULL,
        [FeatureCode]              NVARCHAR(50)      NOT NULL,
        [FeatureName]              NVARCHAR(200)     NOT NULL,
        [Quantity]                 INT               NOT NULL CONSTRAINT [DF_SubscriptionAddOns_Quantity] DEFAULT (1),
        [StripeSubscriptionItemId] NVARCHAR(100)     NULL,
        [StripePriceId]            NVARCHAR(100)     NULL,
        [UnitAmount]               DECIMAL(10,2)     NOT NULL CONSTRAINT [DF_SubscriptionAddOns_UnitAmount] DEFAULT (0),
        [AddedAt]                  DATETIME2         NOT NULL CONSTRAINT [DF_SubscriptionAddOns_AddedAt] DEFAULT (SYSUTCDATETIME()),
        [RemovedAt]                DATETIME2         NULL,
        CONSTRAINT [PK_SubscriptionAddOns] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_SubscriptionAddOns_SubId]
        ON [dbo].[SubscriptionAddOns] ([SubscriptionId])
        WHERE [RemovedAt] IS NULL;

    ALTER TABLE [dbo].[SubscriptionAddOns]
        ADD CONSTRAINT [FK_SubscriptionAddOns_Subscriptions]
            FOREIGN KEY ([SubscriptionId]) REFERENCES [dbo].[Subscriptions] ([Id])
            ON DELETE CASCADE;

    PRINT 'Created SubscriptionAddOns table.';
END
ELSE
    PRINT 'SubscriptionAddOns table already exists - skipped.';
GO

PRINT 'Stripe subscriptions schema migration complete.';
