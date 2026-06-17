/*
================================================================================
Script Name:    20260526_MigrateGridPrefsToColumnAccess.sql
Description:    One-time data migration moving grid column settings from
                dbo.UserPreferences (PreferenceKey LIKE 'grid.columns.%') into
                dbo.UserGridColumnAccess. Storage of "what columns does the
                user see in grid X" is now unified on the single table — the
                in-grid column chooser and the Super Admin grid-settings page
                both read/write the same rows.

                For each UserPreferences row that matches the grid-columns
                key, we:
                  1. Extract the gridId from the PreferenceKey
                     ('grid.columns.<gridId>' → '<gridId>').
                  2. Parse the JSON value with OPENJSON to get one record per
                     column ({field, visible, width, aggregateType}).
                  3. INSERT a row into UserGridColumnAccess per field, mapping
                     visible→AllowedToView, width→Width, aggregateType→AggregateType.
                     UserId is the source row's UserId (these are user-specific
                     overrides — they NEVER touch the tenant default sentinel
                     row at UserId = '00000000-0000-0000-0000-000000000000').
                  4. Skip if a row for (UserId, GridId, Field) already exists
                     in UserGridColumnAccess — idempotent re-runs are safe.
                  5. DELETE the migrated UserPreferences row.

                After this script runs successfully, no UserPreferences rows
                with PreferenceKey LIKE 'grid.columns.%' remain.

Table:          dbo.UserGridColumnAccess (write), dbo.UserPreferences (read+delete)
Database:       Tenant Database (Customer DB)

Created:        2026-05-26
Version:        1.0

Usage:
    Run this script on each tenant (customer) database AFTER:
      - CreateUserGridColumnAccessTable.sql            (base table)
      - AlterUserGridColumnAccessAddDisplayName.sql
      - AlterUserGridColumnAccessAddSortOrder.sql
      - 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate.sql (companion)
      - CreateUserPreferencesTable.sql                 (source table)

    Idempotent — safe to run multiple times. Tracks counts of inserted +
    deleted rows and prints a summary at the end.

Related Files:
    - Companion schema migration:  20260526_AlterUserGridColumnAccess_AddWidthAndAggregate.sql
    - Backend entity:              BackOffice.Domain/Entities/Tenant/UserGridColumnAccess.cs
    - Backend service:             BackOffice.Persistence/Services/Tenant/GridColumnAccessService.cs
    - Frontend service shim:       BackOffice.Presentation/src/services/gridSettingsService.ts
================================================================================
*/

SET NOCOUNT ON;

DECLARE @InsertedCount INT = 0;
DECLARE @SkippedCount  INT = 0;
DECLARE @DeletedCount  INT = 0;
DECLARE @SourceRowCount INT;

SELECT @SourceRowCount = COUNT(*)
FROM   dbo.UserPreferences
WHERE  PreferenceKey LIKE 'grid.columns.%';

PRINT 'UserPreferences rows matching grid.columns.* : ' + CAST(@SourceRowCount AS NVARCHAR(20));

IF @SourceRowCount = 0
BEGIN
    PRINT '';
    PRINT 'Nothing to migrate. Exiting.';
    PRINT '';
    RETURN;
END

-- Stage everything in a temp table so we can do INSERT + DELETE inside
-- a single transaction and roll back cleanly on error.
IF OBJECT_ID('tempdb..#StagingGridPrefs') IS NOT NULL DROP TABLE #StagingGridPrefs;

CREATE TABLE #StagingGridPrefs (
    SourceId        INT             NOT NULL,
    UserId          UNIQUEIDENTIFIER NOT NULL,
    GridId          NVARCHAR(100)   NOT NULL,
    Field           NVARCHAR(100)   NOT NULL,
    AllowedToView   BIT             NOT NULL,
    Width           INT             NULL,
    AggregateType   NVARCHAR(50)    NULL
);

-- Expand each UserPreferences row's JSON into one staging row per column.
INSERT INTO #StagingGridPrefs (SourceId, UserId, GridId, Field, AllowedToView, Width, AggregateType)
SELECT
    up.Id,
    up.UserId,
    -- Strip the 'grid.columns.' prefix to recover the gridId.
    SUBSTRING(up.PreferenceKey, LEN('grid.columns.') + 1, 200)        AS GridId,
    j.field                                                            AS Field,
    CASE WHEN j.visible = 1 THEN 1 ELSE 0 END                          AS AllowedToView,
    -- width=0 in the legacy JSON meant "no override"; treat as NULL.
    NULLIF(j.width, 0)                                                 AS Width,
    -- aggregateType "none" or empty string means "no aggregate"; treat as NULL.
    CASE WHEN j.aggregateType IS NULL
              OR j.aggregateType = ''
              OR j.aggregateType = 'none'
         THEN NULL
         ELSE j.aggregateType
    END                                                                AS AggregateType
FROM   dbo.UserPreferences up
CROSS  APPLY OPENJSON(up.PreferenceValue) WITH (
    field          NVARCHAR(100) '$.field',
    visible        BIT           '$.visible',
    width          INT           '$.width',
    aggregateType  NVARCHAR(50)  '$.aggregateType'
) j
WHERE  up.PreferenceKey LIKE 'grid.columns.%'
  AND  j.field IS NOT NULL
  AND  LEN(j.field) > 0;

DECLARE @StagedCount INT = @@ROWCOUNT;
PRINT 'Staged column rows expanded from JSON       : ' + CAST(@StagedCount AS NVARCHAR(20));

BEGIN TRY
    BEGIN TRANSACTION;

    -- INSERT only rows that don't already exist in the target table
    -- (idempotent: re-running after a partial run is safe).
    INSERT INTO dbo.UserGridColumnAccess
        (UserId, GridId, Field, AllowedToView, DisplayName, SortOrder, Width, AggregateType, DateCreated, DateModified, ModifiedBy)
    SELECT
        s.UserId,
        s.GridId,
        s.Field,
        s.AllowedToView,
        NULL                       AS DisplayName,    -- legacy JSON didn't carry custom labels
        NULL                       AS SortOrder,      -- legacy JSON didn't carry sort order
        s.Width,
        s.AggregateType,
        SYSUTCDATETIME()           AS DateCreated,
        SYSUTCDATETIME()           AS DateModified,
        NULL                       AS ModifiedBy      -- migrated rows have no admin attribution
    FROM   #StagingGridPrefs s
    WHERE  NOT EXISTS (
        SELECT 1
        FROM   dbo.UserGridColumnAccess ugca
        WHERE  ugca.UserId = s.UserId
          AND  ugca.GridId = s.GridId
          AND  ugca.Field  = s.Field
    );

    SET @InsertedCount = @@ROWCOUNT;
    SET @SkippedCount  = @StagedCount - @InsertedCount;

    -- Delete the source UserPreferences rows we successfully migrated. We
    -- delete by SourceId from the staging set so we only remove rows we
    -- actually processed (handles the edge case where a new grid.columns.*
    -- row appears between staging and delete).
    DELETE up
    FROM   dbo.UserPreferences up
    WHERE  up.PreferenceKey LIKE 'grid.columns.%'
      AND  EXISTS (
        SELECT 1 FROM #StagingGridPrefs s WHERE s.SourceId = up.Id
      );

    SET @DeletedCount = @@ROWCOUNT;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR during migration. Transaction rolled back.';
    PRINT 'Error: ' + ERROR_MESSAGE();
    THROW;
END CATCH

DROP TABLE #StagingGridPrefs;

PRINT '';
PRINT '================================================================================';
PRINT 'Grid prefs migration summary:';
PRINT '  Rows inserted into UserGridColumnAccess  : ' + CAST(@InsertedCount AS NVARCHAR(20));
PRINT '  Rows skipped (already existed)           : ' + CAST(@SkippedCount  AS NVARCHAR(20));
PRINT '  UserPreferences rows deleted             : ' + CAST(@DeletedCount  AS NVARCHAR(20));
PRINT '================================================================================';
GO
