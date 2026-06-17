/*
================================================================================
Script Name:    20260526_AlterUserGridColumnAccess_AddWidthAndAggregate_ROLLBACK.sql
Description:    Rollback for 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate.sql.
                Drops the Width and AggregateType columns from
                dbo.UserGridColumnAccess that the forward script added.

WARNING:        These two columns store user-customized column widths and
                per-column aggregate types. DROPPING THEM IS DESTRUCTIVE —
                that data is gone.

                If you need to preserve the data, run
                20260526_MigrateGridPrefsToColumnAccess_ROLLBACK.sql FIRST.
                That data-rollback reads Width / AggregateType and writes
                them back into UserPreferences as JSON. Only then is it
                safe to drop the columns.

                The script aborts with a helpful error if it finds any
                non-NULL value in either column — that's our safety net
                against accidentally losing live customizations.

                To force the drop anyway (e.g. you have a fresh tenant DB
                where the columns were never used), pass @ForceDrop = 1
                inline by uncommenting the variable below.

Execution order:
                Run AFTER 20260526_MigrateGridPrefsToColumnAccess_ROLLBACK.sql
                if you want to preserve data, OR standalone (with @ForceDrop
                set) when you genuinely want to wipe.

Table:          dbo.UserGridColumnAccess
Database:       Tenant Database (Customer DB)

Created:        2026-05-26
Version:        1.0 (rollback)

Usage:
    Idempotent. Safe to re-run after the columns are already gone.

Related Files:
    - Forward migration:        20260526_AlterUserGridColumnAccess_AddWidthAndAggregate.sql
    - Companion data-rollback:  20260526_MigrateGridPrefsToColumnAccess_ROLLBACK.sql
================================================================================
*/

SET NOCOUNT ON;

-- Set to 1 to skip the "rows still have data" safety check and drop anyway.
DECLARE @ForceDrop BIT = 0;

DECLARE @NonNullWidthCount     INT = 0;
DECLARE @NonNullAggregateCount INT = 0;

-- Safety check: count rows that still have Width or AggregateType populated.
-- If either is non-zero AND @ForceDrop is 0, raise an error so the operator
-- runs the data-rollback first.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
      AND  name = N'Width'
)
BEGIN
    SELECT @NonNullWidthCount = COUNT(*)
    FROM   dbo.UserGridColumnAccess
    WHERE  Width IS NOT NULL;
END

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
      AND  name = N'AggregateType'
)
BEGIN
    SELECT @NonNullAggregateCount = COUNT(*)
    FROM   dbo.UserGridColumnAccess
    WHERE  AggregateType IS NOT NULL;
END

PRINT 'Rows with non-NULL Width         : ' + CAST(@NonNullWidthCount     AS NVARCHAR(20));
PRINT 'Rows with non-NULL AggregateType : ' + CAST(@NonNullAggregateCount AS NVARCHAR(20));

IF (@NonNullWidthCount > 0 OR @NonNullAggregateCount > 0) AND @ForceDrop = 0
BEGIN
    PRINT '';
    PRINT '================================================================================';
    PRINT 'ABORTING: live data exists in Width / AggregateType columns.';
    PRINT '';
    PRINT 'Run 20260526_MigrateGridPrefsToColumnAccess_ROLLBACK.sql first to move that';
    PRINT 'data back into UserPreferences. Then re-run this script.';
    PRINT '';
    PRINT 'If you actually want to drop the columns and lose the data, edit this script';
    PRINT 'and set @ForceDrop = 1 at the top.';
    PRINT '================================================================================';
    THROW 50001,
          'UserGridColumnAccess Width/AggregateType columns still contain data. Run data-rollback first or set @ForceDrop=1.',
          1;
END

------------------------------------------------------------------------
-- Drop AggregateType
------------------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
      AND  name = N'AggregateType'
)
BEGIN
    PRINT 'Dropping column [AggregateType] from [dbo].[UserGridColumnAccess]...';

    ALTER TABLE [dbo].[UserGridColumnAccess]
    DROP COLUMN [AggregateType];

    PRINT 'Column [AggregateType] dropped successfully.';
END
ELSE
BEGIN
    PRINT 'Column [AggregateType] does not exist on [dbo].[UserGridColumnAccess]. Skipping.';
END
GO

------------------------------------------------------------------------
-- Drop Width
------------------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
      AND  name = N'Width'
)
BEGIN
    PRINT 'Dropping column [Width] from [dbo].[UserGridColumnAccess]...';

    ALTER TABLE [dbo].[UserGridColumnAccess]
    DROP COLUMN [Width];

    PRINT 'Column [Width] dropped successfully.';
END
ELSE
BEGIN
    PRINT 'Column [Width] does not exist on [dbo].[UserGridColumnAccess]. Skipping.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserGridColumnAccess Width + AggregateType rollback completed.';
PRINT '================================================================================';
GO
