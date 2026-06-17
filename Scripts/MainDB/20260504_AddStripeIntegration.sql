-- =============================================
-- 20260504 - Add Stripe Integration schema
-- =============================================
-- Adds payment tracking columns to existing Subscriptions and Customers tables,
-- and creates PendingUpgrades + StripeWebhookEvents tables to support a hosted
-- Stripe Checkout flow for plan upgrades.
--
-- Idempotent: safe to re-run.
-- =============================================

SET NOCOUNT ON;

-- ---------------------------------------------
-- 1. Subscriptions: payment status fields
-- ---------------------------------------------

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]')
      AND name = N'IsPaid'
)
BEGIN
    ALTER TABLE [dbo].[Subscriptions]
        ADD [IsPaid] BIT NOT NULL
            CONSTRAINT [DF_Subscriptions_IsPaid] DEFAULT (0);
    PRINT 'Added Subscriptions.IsPaid column.';
END
ELSE
BEGIN
    PRINT 'Subscriptions.IsPaid column already exists - skipped.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]')
      AND name = N'LastPaymentAt'
)
BEGIN
    ALTER TABLE [dbo].[Subscriptions]
        ADD [LastPaymentAt] DATETIME2 NULL;
    PRINT 'Added Subscriptions.LastPaymentAt column.';
END
ELSE
BEGIN
    PRINT 'Subscriptions.LastPaymentAt column already exists - skipped.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]')
      AND name = N'StripeLastSessionId'
)
BEGIN
    ALTER TABLE [dbo].[Subscriptions]
        ADD [StripeLastSessionId] NVARCHAR(200) NULL;
    PRINT 'Added Subscriptions.StripeLastSessionId column.';
END
ELSE
BEGIN
    PRINT 'Subscriptions.StripeLastSessionId column already exists - skipped.';
END
GO

-- ---------------------------------------------
-- 2. Customers: Stripe Customer ID mapping
-- ---------------------------------------------

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Customers]')
      AND name = N'StripeCustomerId'
)
BEGIN
    ALTER TABLE [dbo].[Customers]
        ADD [StripeCustomerId] NVARCHAR(100) NULL;
    PRINT 'Added Customers.StripeCustomerId column.';
END
ELSE
BEGIN
    PRINT 'Customers.StripeCustomerId column already exists - skipped.';
END
GO

-- ---------------------------------------------
-- 3. PendingUpgrades table
--    Stores the desired plan change keyed by the Stripe Checkout session ID.
--    Webhook handler reads this on checkout.session.completed and applies it.
-- ---------------------------------------------

IF OBJECT_ID(N'[dbo].[PendingUpgrades]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PendingUpgrades] (
        [Id]                 INT IDENTITY(1,1) NOT NULL,
        [SessionId]          NVARCHAR(200)     NOT NULL,
        [CustomerId]         INT               NOT NULL,
        [NewPlanId]          INT               NOT NULL,
        [EffectiveDate]      DATETIME2         NULL,
        [Notes]              NVARCHAR(500)     NULL,
        [RequestedByUserId]  INT               NULL,
        [CreatedAt]          DATETIME2         NOT NULL CONSTRAINT [DF_PendingUpgrades_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [CompletedAt]        DATETIME2         NULL,
        CONSTRAINT [PK_PendingUpgrades] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_PendingUpgrade_SessionId]
        ON [dbo].[PendingUpgrades] ([SessionId]);

    CREATE NONCLUSTERED INDEX [IX_PendingUpgrade_CustomerId]
        ON [dbo].[PendingUpgrades] ([CustomerId]);

    ALTER TABLE [dbo].[PendingUpgrades]
        ADD CONSTRAINT [FK_PendingUpgrades_Customers]
            FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers] ([CustomerId])
            ON DELETE CASCADE;

    ALTER TABLE [dbo].[PendingUpgrades]
        ADD CONSTRAINT [FK_PendingUpgrades_Plans]
            FOREIGN KEY ([NewPlanId]) REFERENCES [dbo].[Plans] ([Id]);

    PRINT 'Created PendingUpgrades table.';
END
ELSE
BEGIN
    PRINT 'PendingUpgrades table already exists - skipped.';
END
GO

-- ---------------------------------------------
-- 4. StripeWebhookEvents table
--    Idempotency log for incoming Stripe webhooks (dedup by event.id).
-- ---------------------------------------------

IF OBJECT_ID(N'[dbo].[StripeWebhookEvents]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[StripeWebhookEvents] (
        [Id]               INT IDENTITY(1,1) NOT NULL,
        [EventId]          NVARCHAR(200)     NOT NULL,
        [EventType]        NVARCHAR(100)     NOT NULL,
        [ReceivedAt]       DATETIME2         NOT NULL CONSTRAINT [DF_StripeWebhookEvents_ReceivedAt] DEFAULT (SYSUTCDATETIME()),
        [ProcessedAt]      DATETIME2         NULL,
        [ProcessingError]  NVARCHAR(2000)    NULL,
        CONSTRAINT [PK_StripeWebhookEvents] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_StripeWebhookEvent_EventId]
        ON [dbo].[StripeWebhookEvents] ([EventId]);

    PRINT 'Created StripeWebhookEvents table.';
END
ELSE
BEGIN
    PRINT 'StripeWebhookEvents table already exists - skipped.';
END
GO

PRINT 'Stripe integration schema migration complete.';
