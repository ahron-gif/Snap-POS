-- =============================================================================
-- 20260501_SeedApps_LicensesBilling.sql
--
-- Aligns dbo.Apps with the four apps the Licenses & Billing UI expects:
--     1 = Web App, 2 = POS Terminals, 3 = Picking Devices, 4 = Price Checkers
--
-- Why these AppIds: existing dbo.PlanAppPricings rows already reference
-- AppIds 1..5 — using these IDs preserves all current pricing/limits data.
-- AppId 5 is an orphan (no app for it) and any PlanAppPricings rows are deleted.
--
-- Idempotent — safe to re-run. Detects identity column and adjusts INSERT.
-- Frontend deviceStyleMap matches by lowercase substring (web / pos / picking /
-- price), so all four names auto-resolve to the right icon.
--
-- Run against MainDB.
-- =============================================================================

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.Apps', N'U') IS NULL
BEGIN
    PRINT 'dbo.Apps not found. Aborting.';
    RETURN;
END;

-- ----------------------------------------------------------------------------
-- 1. Rename existing apps to match the expected names
-- ----------------------------------------------------------------------------

UPDATE dbo.Apps SET AppName = N'Web App'       WHERE AppId = 1 AND AppName <> N'Web App';
IF @@ROWCOUNT > 0 PRINT 'Renamed AppId 1 -> Web App.';

UPDATE dbo.Apps SET AppName = N'POS Terminals' WHERE AppId = 2 AND AppName <> N'POS Terminals';
IF @@ROWCOUNT > 0 PRINT 'Renamed AppId 2 -> POS Terminals.';

-- ----------------------------------------------------------------------------
-- 2. Insert missing apps (AppId 3, 4). Detect which column is identity so the
--    INSERT works whether dbo.Apps.Id or dbo.Apps.AppId is auto-generated.
-- ----------------------------------------------------------------------------

DECLARE @AppIdIsIdentity INT = COLUMNPROPERTY(OBJECT_ID(N'dbo.Apps'), N'AppId', N'IsIdentity');

IF NOT EXISTS (SELECT 1 FROM dbo.Apps WHERE AppId = 3)
BEGIN
    IF @AppIdIsIdentity = 1
    BEGIN
        SET IDENTITY_INSERT dbo.Apps ON;
        INSERT INTO dbo.Apps (AppId, AppName) VALUES (3, N'Picking Devices');
        SET IDENTITY_INSERT dbo.Apps OFF;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Apps (AppId, AppName) VALUES (3, N'Picking Devices');
    END
    PRINT 'Inserted AppId 3 -> Picking Devices.';
END
ELSE
BEGIN
    PRINT 'AppId 3 already exists - skipped.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Apps WHERE AppId = 4)
BEGIN
    IF @AppIdIsIdentity = 1
    BEGIN
        SET IDENTITY_INSERT dbo.Apps ON;
        INSERT INTO dbo.Apps (AppId, AppName) VALUES (4, N'Price Checkers');
        SET IDENTITY_INSERT dbo.Apps OFF;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Apps (AppId, AppName) VALUES (4, N'Price Checkers');
    END
    PRINT 'Inserted AppId 4 -> Price Checkers.';
END
ELSE
BEGIN
    PRINT 'AppId 4 already exists - skipped.';
END;

-- ----------------------------------------------------------------------------
-- 3. Drop orphan PlanAppPricings rows for AppId 5 (no app exists for it).
-- ----------------------------------------------------------------------------

IF OBJECT_ID(N'dbo.PlanAppPricings', N'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.PlanAppPricings WHERE AppId = 5;
    IF @@ROWCOUNT > 0
        PRINT CONCAT('Deleted ', @@ROWCOUNT, ' orphan PlanAppPricings row(s) for AppId 5.');
END;

-- Also drop any other orphans (PlanAppPricings rows pointing at AppIds with
-- no corresponding dbo.Apps row) so the Edit Plan modal stays clean.
IF OBJECT_ID(N'dbo.PlanAppPricings', N'U') IS NOT NULL
BEGIN
    DELETE pap
    FROM dbo.PlanAppPricings pap
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Apps a WHERE a.AppId = pap.AppId);
    IF @@ROWCOUNT > 0
        PRINT CONCAT('Deleted ', @@ROWCOUNT, ' additional orphan PlanAppPricings row(s).');
END;

-- ----------------------------------------------------------------------------
-- 4. Final state for visibility
-- ----------------------------------------------------------------------------

PRINT '';
PRINT 'Current dbo.Apps catalog:';
SELECT AppId, AppName, Comment FROM dbo.Apps ORDER BY AppId;

PRINT 'Apps seed complete.';
