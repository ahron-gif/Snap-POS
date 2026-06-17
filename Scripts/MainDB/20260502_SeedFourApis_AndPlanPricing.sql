-- =============================================================================
-- 20260502_SeedFourApis_AndPlanPricing.sql
--
-- Aligns the API catalog and per-plan pricing with the four currently-billed
-- APIs:
--   1. ITEM_SYNC         — Item Sync API
--   2. CUSTOMER_SYNC     — Customer Sync API
--   3. PHONE_ORDER       — Create Phone Order API
--   4. CUSTOMER_CREATE   — Customer Create API   (NEW)
--
-- Actions:
--   * Inserts CUSTOMER_CREATE into dbo.ApiDefinitions if missing
--   * For each active Plan × each of the 4 APIs, inserts a row into
--     dbo.PlanApiPricings if one doesn't already exist (uses each
--     ApiDefinition's DefaultRatePerCall + DefaultFreeTier as starting values).
--   * Reports the resulting pricing matrix at the end.
--
-- Run against MainDB. Idempotent — safe to re-run.
-- =============================================================================

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.ApiDefinitions', N'U') IS NULL OR OBJECT_ID(N'dbo.PlanApiPricings', N'U') IS NULL
BEGIN
    PRINT 'Required tables (ApiDefinitions / PlanApiPricings) not found. Aborting.';
    RETURN;
END;

-- ----------------------------------------------------------------------------
-- 1. Ensure CUSTOMER_CREATE exists in dbo.ApiDefinitions
-- ----------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM dbo.ApiDefinitions WHERE Code = N'CUSTOMER_CREATE')
BEGIN
    INSERT INTO dbo.ApiDefinitions
        (Name, Code, Description, DefaultRatePerCall, DefaultFreeTier, IsActive, SortOrder, CreatedAt)
    VALUES
        (N'Customer Create API',
         N'CUSTOMER_CREATE',
         N'Creates new customer records via external systems / portal.',
         0.15,
         250,
         1,
         4,
         SYSUTCDATETIME());
    PRINT 'Inserted CUSTOMER_CREATE into ApiDefinitions.';
END
ELSE
BEGIN
    PRINT 'CUSTOMER_CREATE already exists in ApiDefinitions - skipped.';
END;

-- Optional: refresh display name on PHONE_ORDER so the dashboard reads
-- "Create Phone Order" instead of just "Phone Order". Comment out if you
-- already renamed it.
UPDATE dbo.ApiDefinitions
SET Name = N'Create Phone Order API'
WHERE Code = N'PHONE_ORDER' AND Name <> N'Create Phone Order API';
IF @@ROWCOUNT > 0 PRINT 'Refreshed PHONE_ORDER display name to "Create Phone Order API".';

-- ----------------------------------------------------------------------------
-- 2. Insert missing PlanApiPricings rows for each (active Plan × any of the 4 APIs)
-- ----------------------------------------------------------------------------

DECLARE @TargetCodes TABLE (Code NVARCHAR(50) PRIMARY KEY);
INSERT INTO @TargetCodes (Code) VALUES
    (N'ITEM_SYNC'),
    (N'CUSTOMER_SYNC'),
    (N'PHONE_ORDER'),
    (N'CUSTOMER_CREATE');

INSERT INTO dbo.PlanApiPricings
    (PlanId, ApiDefinitionId, RatePerCall, FreeTierCalls, IsIncluded, CreatedAt)
SELECT
    p.Id,
    ad.Id,
    ad.DefaultRatePerCall,
    ad.DefaultFreeTier,
    1,                       -- included by default; adjust per plan via Edit Plan UI later
    SYSUTCDATETIME()
FROM dbo.Plans p
CROSS JOIN dbo.ApiDefinitions ad
INNER JOIN @TargetCodes t ON t.Code = ad.Code
WHERE p.IsActive = 1
  AND ad.IsActive = 1
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.PlanApiPricings pap
      WHERE pap.PlanId = p.Id
        AND pap.ApiDefinitionId = ad.Id
  );

DECLARE @Inserted INT = @@ROWCOUNT;
PRINT CONCAT('Inserted ', @Inserted, ' new PlanApiPricings row(s) across all active plans.');

-- ----------------------------------------------------------------------------
-- 3. Report the resulting pricing matrix for visibility
-- ----------------------------------------------------------------------------

PRINT '';
PRINT 'Per-plan pricing for the 4 metered APIs:';
SELECT
    p.Name                                                  AS PlanName,
    ad.Code                                                 AS ApiCode,
    ad.Name                                                 AS ApiName,
    pap.RatePerCall,
    pap.FreeTierCalls,
    pap.IsIncluded,
    CASE WHEN pap.Id IS NULL THEN 'MISSING' ELSE 'OK' END   AS PricingRowStatus
FROM dbo.Plans p
CROSS JOIN dbo.ApiDefinitions ad
INNER JOIN @TargetCodes t ON t.Code = ad.Code
LEFT JOIN dbo.PlanApiPricings pap
       ON pap.PlanId = p.Id AND pap.ApiDefinitionId = ad.Id
WHERE p.IsActive = 1
  AND ad.IsActive = 1
ORDER BY p.SortOrder, p.Name, ad.SortOrder, ad.Code;

PRINT '';
PRINT 'Four-API pricing seed complete.';
