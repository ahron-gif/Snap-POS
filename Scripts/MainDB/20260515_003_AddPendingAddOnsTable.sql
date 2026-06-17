-- =============================================================================
-- 20260515_003_AddPendingAddOnsTable.sql
--
-- Backing table for the Stripe Checkout-redirect flow used to charge mid-cycle
-- add-ons (extra devices/users beyond a Plan's FreeUnits). Mirrors the
-- PendingUpgrades pattern: row inserted on Checkout creation, CompletedAt set
-- when webhook / status-poll / reconcile observes the session as paid and
-- applies the change to the Stripe subscription.
--
-- Apply to: MAIN DB
-- Idempotent.
-- =============================================================================

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PendingAddOns]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[PendingAddOns] (
        [Id]                  INT             IDENTITY(1,1) NOT NULL,
        [SessionId]           NVARCHAR(200)   NOT NULL,
        [CustomerId]          INT             NOT NULL,
        [ItemsJson]           NVARCHAR(MAX)   NOT NULL,
        [ProrationAmount]     DECIMAL(10, 2)  NOT NULL CONSTRAINT [DF_PendingAddOns_ProrationAmount] DEFAULT (0),
        [Notes]               NVARCHAR(500)   NULL,
        [RequestedByUserId]   INT             NULL,
        [CreatedAt]           DATETIME2(7)    NOT NULL CONSTRAINT [DF_PendingAddOns_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [CompletedAt]         DATETIME2(7)    NULL,
        CONSTRAINT [PK_PendingAddOns] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_PendingAddOns_Customers]
            FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers] ([CustomerId]) ON DELETE CASCADE
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_PendingAddOn_SessionId]
        ON [dbo].[PendingAddOns] ([SessionId] ASC);

    CREATE NONCLUSTERED INDEX [IX_PendingAddOn_CustomerId]
        ON [dbo].[PendingAddOns] ([CustomerId] ASC);

    PRINT 'Created PendingAddOns table.';
END
ELSE
BEGIN
    PRINT 'PendingAddOns table already exists — skipping.';
END
