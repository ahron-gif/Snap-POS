/*
================================================================================
Script Name:    20260526_AlterUserGridColumnAccess_AddWidthAndAggregate.sql
Description:    Adds two nullable columns to UserGridColumnAccess so the same
                table can carry the FULL per-column preference set (visibility,
                display name, sort order, width, aggregate type). Previously
                width + aggregate lived in UserPreference (key 'grid.columns.*')
                while visibility/order/label lived here — two storage paths for
                the same logical concern.

                After this migration the storage is unified. A companion script
                (20260526_MigrateGridPrefsToColumnAccess.sql) moves existing
                UserPreference grid rows into this table and deletes the
                originals.

                Both new columns are nullable:
                  - NULL Width        => use the column's natural width
                  - NULL AggregateType => no aggregation row at the footer
                Tenant-default rows (UserId = Guid.Empty) MAY set these too,
                in which case user-override rows that match the default are
                NOT persisted (smart-save in GridColumnAccessService).

Table:          dbo.UserGridColumnAccess
Database:       Tenant Database (Customer DB)

Created:        2026-05-26
Version:        1.3

Usage:
    Run this script on each tenant (customer) database AFTER the base
    CreateUserGridColumnAccessTable.sql has already run. It's idempotent —
    safe to run multiple times.

Related Files:
    - Base migration:           Scripts/TenantDB/CreateUserGridColumnAccessTable.sql
    - Previous migrations:      AlterUserGridColumnAccessAddDisplayName.sql
                                AlterUserGridColumnAccessAddSortOrder.sql
    - Companion migration:      20260526_MigrateGridPrefsToColumnAccess.sql
    - Backend entity:           BackOffice.Domain/Entities/Tenant/UserGridColumnAccess.cs
    - Backend DTO:              BackOffice.Application/DTOs/Tenant/GridColumnAccess/GridColumnAccessDto.cs
    - Backend service:          BackOffice.Persistence/Services/Tenant/GridColumnAccessService.cs
    - Frontend service:         BackOffice.Presentation/src/services/gridColumnAccessService.ts
    - Frontend hook:            BackOffice.Presentation/src/hooks/useGridSettings.ts
================================================================================
*/

IF NOT EXISTS (
    SELECT 1
    FROM   sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
       AND name = N'Width'
)
BEGIN
    PRINT 'Adding column [Width] to [dbo].[UserGridColumnAccess]...';

    ALTER TABLE [dbo].[UserGridColumnAccess]
    ADD [Width] INT NULL;

    PRINT 'Column [Width] added successfully.';
END
ELSE
BEGIN
    PRINT 'Column [Width] already exists on [dbo].[UserGridColumnAccess]. Skipping.';
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM   sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
       AND name = N'AggregateType'
)
BEGIN
    PRINT 'Adding column [AggregateType] to [dbo].[UserGridColumnAccess]...';

    ALTER TABLE [dbo].[UserGridColumnAccess]
    ADD [AggregateType] NVARCHAR(50) NULL;

    PRINT 'Column [AggregateType] added successfully.';
END
ELSE
BEGIN
    PRINT 'Column [AggregateType] already exists on [dbo].[UserGridColumnAccess]. Skipping.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserGridColumnAccess Width + AggregateType migration completed.';
PRINT '================================================================================';
GO
