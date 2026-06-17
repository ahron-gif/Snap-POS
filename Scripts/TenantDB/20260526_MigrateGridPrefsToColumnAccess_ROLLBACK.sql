/*
================================================================================
Script Name:    20260526_MigrateGridPrefsToColumnAccess_ROLLBACK.sql
Description:    Rollback for 20260526_MigrateGridPrefsToColumnAccess.sql.
                Moves user-override rows from dbo.UserGridColumnAccess back
                into dbo.UserPreferences as 'grid.columns.<gridId>' rows, then
                deletes the migrated rows from UserGridColumnAccess.

How rows are identified for rollback:
                We filter user-override rows (UserId <> '00000000-0000-0000-0000-000000000000')
                where ModifiedBy IS NULL. The forward migration deliberately
                wrote NULL for ModifiedBy so this script could find them again.
                Rows where ModifiedBy IS NOT NULL came from the Super Admin
                grid-settings UI (admin attribution recorded) and are LEFT
                ALONE — those were never in UserPreferences to begin with.

                Caveat: this heuristic is not bulletproof. If any
                pre-migration admin-set rows happened to have ModifiedBy=NULL
                (e.g. legacy data from before ModifiedBy was added), they will
                be incorrectly treated as migrated and moved out. Inspect the
                output counts before deploying — if the "rows moved" number
                seems suspicious, ROLLBACK the transaction manually before
                committing.

Execution order:
                Run this script BEFORE the companion schema-rollback
                (20260526_AlterUserGridColumnAccess_AddWidthAndAggregate_ROLLBACK.sql)
                because we read Width and AggregateType columns here. Dropping
                the schema first would lose that data.

Table:          dbo.UserPreferences (write), dbo.UserGridColumnAccess (read+delete)
Database:       Tenant Database (Customer DB)

Created:        2026-05-26
Version:        1.0 (rollback)

Usage:
    Idempotent on the schema/structural side. Re-running after a successful
    rollback is a no-op (nothing matches the filter anymore). Wrapped in a
    transaction — on any error the entire rollback is rolled back.

Related Files:
    - Forward migration:        20260526_MigrateGridPrefsToColumnAccess.sql
    - Companion schema-rollback: 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate_ROLLBACK.sql
================================================================================
*/

SET NOCOUNT ON;

-- Width
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]') AND name = N'Width')
BEGIN
    ALTER TABLE [dbo].[UserGridColumnAccess] ADD [Width] INT NULL;
    PRINT 'Added column: Width';
END
ELSE PRINT 'Skipped (exists): Width';
GO

-- AggregateType
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]') AND name = N'AggregateType')
BEGIN
    ALTER TABLE [dbo].[UserGridColumnAccess] ADD [AggregateType] NVARCHAR(100) NULL;
    PRINT 'Added column: AggregateType';
END
ELSE PRINT 'Skipped (exists): AggregateType';
GO

DECLARE @TenantDefaultUserId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000000';
DECLARE @CandidateRowCount   INT;
DECLARE @PreferenceRowsCount INT = 0;
DECLARE @DeletedRowsCount    INT = 0;

SELECT @CandidateRowCount = COUNT(*)
FROM   dbo.UserGridColumnAccess
WHERE  UserId    <> @TenantDefaultUserId
  AND  ModifiedBy IS NULL;

PRINT 'Candidate UserGridColumnAccess rows (UserId<>empty AND ModifiedBy IS NULL) : '
      + CAST(@CandidateRowCount AS NVARCHAR(20));

IF @CandidateRowCount = 0
BEGIN
    PRINT '';
    PRINT 'Nothing to rollback. Exiting.';
    PRINT '';
    RETURN;
END

-- Pre-compute the (UserId, GridId) pairs we will touch, plus rebuild the
-- JSON value per pair using FOR JSON. This handles two upsert paths:
--   (a) UserPreferences has no row for this (UserId, key) — INSERT
--   (b) UserPreferences already has a row     — UPDATE (overwrite the value)
IF OBJECT_ID('tempdb..#PrefRebuild') IS NOT NULL DROP TABLE #PrefRebuild;

CREATE TABLE #PrefRebuild (
    UserId          UNIQUEIDENTIFIER NOT NULL,
    GridId          NVARCHAR(100)    NOT NULL,
    PreferenceKey   NVARCHAR(100)    NOT NULL,
    PreferenceValue NVARCHAR(MAX)    NOT NULL,
    PRIMARY KEY (UserId, GridId)
);

;WITH PerColumn AS (
    SELECT
        UserId,
        GridId,
        Field         AS field,
        AllowedToView AS visible,
        -- Legacy JSON shape used width: number (0 meant "no override").
        -- Restore that convention so re-running the forward migration would
        -- produce the same staging rows.
        ISNULL(Width, 0)                   AS width,
        ISNULL(AggregateType, N'none')     AS aggregateType
    FROM dbo.UserGridColumnAccess
    WHERE UserId    <> @TenantDefaultUserId
      AND ModifiedBy IS NULL
)
INSERT INTO #PrefRebuild (UserId, GridId, PreferenceKey, PreferenceValue)
SELECT
    pc.UserId,
    pc.GridId,
    N'grid.columns.' + pc.GridId AS PreferenceKey,
    (
        SELECT
            sub.field          AS field,
            CAST(sub.visible AS BIT) AS visible,
            sub.width          AS width,
            sub.aggregateType  AS aggregateType
        FROM   PerColumn sub
        WHERE  sub.UserId = pc.UserId
          AND  sub.GridId = pc.GridId
        FOR JSON PATH
    ) AS PreferenceValue
FROM   PerColumn pc
GROUP  BY pc.UserId, pc.GridId;

DECLARE @RebuildPairCount INT = @@ROWCOUNT;
PRINT 'Distinct (UserId, GridId) pairs to write into UserPreferences          : '
      + CAST(@RebuildPairCount AS NVARCHAR(20));

BEGIN TRY
    BEGIN TRANSACTION;

    -- Upsert into UserPreferences (one row per (UserId, PreferenceKey)).
    MERGE dbo.UserPreferences AS tgt
    USING #PrefRebuild        AS src
       ON tgt.UserId        = src.UserId
      AND tgt.PreferenceKey = src.PreferenceKey
    WHEN MATCHED THEN
        UPDATE SET
            tgt.PreferenceValue = src.PreferenceValue,
            tgt.DateModified    = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (UserId, PreferenceKey, PreferenceValue, DateCreated, DateModified)
        VALUES (src.UserId, src.PreferenceKey, src.PreferenceValue,
                SYSUTCDATETIME(), SYSUTCDATETIME());

    SET @PreferenceRowsCount = @@ROWCOUNT;

    -- Now delete the rolled-back rows from UserGridColumnAccess. Re-apply
    -- the same filter to be defensive (the temp table is the canonical
    -- working set, but explicit filtering avoids touching rows added
    -- between the candidate count and now).
    DELETE ugca
    FROM   dbo.UserGridColumnAccess ugca
    WHERE  ugca.UserId    <> @TenantDefaultUserId
      AND  ugca.ModifiedBy IS NULL
      AND  EXISTS (
          SELECT 1
          FROM   #PrefRebuild p
          WHERE  p.UserId = ugca.UserId
            AND  p.GridId = ugca.GridId
      );

    SET @DeletedRowsCount = @@ROWCOUNT;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR during rollback. Transaction rolled back.';
    PRINT 'Error: ' + ERROR_MESSAGE();
    THROW;
END CATCH

DROP TABLE #PrefRebuild;

PRINT '';
PRINT '================================================================================';
PRINT 'Grid prefs rollback summary:';
PRINT '  UserPreferences rows touched (upserted)         : '
      + CAST(@PreferenceRowsCount AS NVARCHAR(20));
PRINT '  UserGridColumnAccess rows deleted               : '
      + CAST(@DeletedRowsCount    AS NVARCHAR(20));
PRINT '';
PRINT '  NEXT STEP: run 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate_ROLLBACK.sql';
PRINT '  to drop the Width and AggregateType columns once you have verified';
PRINT '  the upsert above is correct.';
PRINT '================================================================================';
GO
