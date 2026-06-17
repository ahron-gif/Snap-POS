-- =============================================================================
-- 20260515_002_AddStripeOveragePriceIdToPlanAppPricing.sql
--
-- Adds the Stripe Price id used for mid-cycle add-on charges (extra devices /
-- users beyond a Plan's FreeUnits). One Price per PlanAppPricing row that has
-- a non-flat PricingModel and PricePerUnit > 0; created lazily on next
-- StripeCatalogService.SyncPlanAsync run.
--
-- Apply to: MAIN DB
-- Idempotent.
-- =============================================================================

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[PlanAppPricings]')
      AND name = 'StripeOveragePriceId'
)
BEGIN
    ALTER TABLE [dbo].[PlanAppPricings]
        ADD [StripeOveragePriceId] NVARCHAR(100) NULL;

    PRINT 'Added StripeOveragePriceId column to PlanAppPricings.';
END
ELSE
BEGIN
    PRINT 'StripeOveragePriceId column already exists on PlanAppPricings — skipping.';
END
