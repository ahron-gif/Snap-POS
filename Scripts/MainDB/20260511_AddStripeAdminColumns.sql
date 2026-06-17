-- =============================================
-- 20260511 - Phase 6: Super-admin Stripe management
-- =============================================
-- Adds:
--   Subscriptions.PauseCollectionBehavior  -- tracks Stripe pause_collection state
--   SubscriptionHistories.ChangedByRole    -- 'admin' / 'tenant' / 'system'
--
-- Idempotent: safe to re-run.
-- =============================================

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[Subscriptions]')
                 AND name = N'PauseCollectionBehavior')
BEGIN
    ALTER TABLE [dbo].[Subscriptions] ADD [PauseCollectionBehavior] NVARCHAR(50) NULL;
    PRINT 'Added Subscriptions.PauseCollectionBehavior.';
END
ELSE
    PRINT 'Subscriptions.PauseCollectionBehavior already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[SubscriptionHistories]')
                 AND name = N'ChangedByRole')
BEGIN
    ALTER TABLE [dbo].[SubscriptionHistories]
        ADD [ChangedByRole] NVARCHAR(20) NULL;
    PRINT 'Added SubscriptionHistories.ChangedByRole.';
END
ELSE
    PRINT 'SubscriptionHistories.ChangedByRole already exists - skipped.';
GO

PRINT 'Phase 6 super-admin schema migration complete.';
