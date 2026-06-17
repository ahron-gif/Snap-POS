/*
================================================================================
Script Name:    20260501_Add_CustomDateScope_SortOrder.sql
Description:    Adds SortOrder column + filtered index to dbo.CustomDateScope
                so users can manually order their saved date scopes (1, 2, 3, ...).

                Run against:    Tenant database (e.g. Develop_SelfCheckout).
                Idempotent:     safe to run multiple times.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '== Add CustomDateScope.SortOrder ==';

-- ============================================================================
-- 1. Add SortOrder column (nullable so we can backfill, then NOT NULL)
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CustomDateScope') AND name = 'SortOrder'
)
BEGIN
    ALTER TABLE dbo.CustomDateScope ADD SortOrder INT NULL;
    PRINT '  [OK] Column SortOrder added.';
END
ELSE
BEGIN
    PRINT '  [SKIP] Column SortOrder already exists.';
END
GO

-- ============================================================================
-- 2. Backfill SortOrder for active rows (1..N by CreatedAt)
-- ============================================================================
IF EXISTS (
    SELECT 1 FROM dbo.CustomDateScope WHERE SortOrder IS NULL AND IsActive = 1
)
BEGIN
    ;WITH numbered AS (
        SELECT CustomDateScopeID,
               ROW_NUMBER() OVER (ORDER BY CreatedAt, CustomDateScopeID) AS rn
        FROM dbo.CustomDateScope
        WHERE IsActive = 1 AND SortOrder IS NULL
    )
    UPDATE c
       SET c.SortOrder = numbered.rn
      FROM dbo.CustomDateScope c
     INNER JOIN numbered ON numbered.CustomDateScopeID = c.CustomDateScopeID;
    PRINT '  [OK] Backfilled SortOrder for active rows.';
END

-- Inactive rows: park at 0 so the column can be NOT NULL.
UPDATE dbo.CustomDateScope SET SortOrder = 0 WHERE SortOrder IS NULL;
GO

-- ============================================================================
-- 3. Mark SortOrder NOT NULL
-- ============================================================================
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CustomDateScope')
      AND name = 'SortOrder'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.CustomDateScope ALTER COLUMN SortOrder INT NOT NULL;
    PRINT '  [OK] SortOrder marked NOT NULL.';
END
GO

-- ============================================================================
-- 4. Filtered index for fast list queries
-- ============================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.CustomDateScope')
      AND name = 'IX_CustomDateScope_SortOrder_Active'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_CustomDateScope_SortOrder_Active
        ON dbo.CustomDateScope (SortOrder)
        INCLUDE (Name, IsActive)
        WHERE IsActive = 1;
    PRINT '  [OK] IX_CustomDateScope_SortOrder_Active created.';
END
ELSE
BEGIN
    PRINT '  [SKIP] IX_CustomDateScope_SortOrder_Active already exists.';
END
GO

-- ============================================================================
-- 5. Verification
-- ============================================================================
SELECT TOP 20 CustomDateScopeID, Name, SortOrder, IsActive, CreatedAt
FROM dbo.CustomDateScope
WHERE IsActive = 1
ORDER BY SortOrder;

PRINT '== Done ==';
