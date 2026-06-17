/*
================================================================================
Script Name:    AlterUserGridColumnAccessAddSortOrder.sql
Description:    Adds a nullable SortOrder column to the UserGridColumnAccess
                table. Lets Super Admins control the order columns appear in
                a grid on a per-user or tenant-wide basis.

                NULL means "use the column's natural order from the column
                definitions". A non-null value places the column at that
                position (lower = earlier).

Table:          dbo.UserGridColumnAccess
Database:       Tenant Database (Customer DB)

Created:        2026-04-18
Version:        1.2

Usage:
    Run this script on each tenant (customer) database AFTER the base
    CreateUserGridColumnAccessTable.sql has already run. It's idempotent —
    safe to run twice.

Related Files:
    - Base migration:        Scripts/CreateUserGridColumnAccessTable.sql
    - Previous migration:    Scripts/AlterUserGridColumnAccessAddDisplayName.sql
    - Backend entity:        BackOffice.Domain/Entities/Tenant/UserGridColumnAccess.cs
    - Backend DTO:           BackOffice.Application/DTOs/Tenant/GridColumnAccess/GridColumnAccessDto.cs
    - Backend service:       BackOffice.Persistence/Services/Tenant/GridColumnAccessService.cs
    - Frontend service:      BackOffice.Presentation/src/services/gridColumnAccessService.ts
    - Frontend hook:         BackOffice.Presentation/src/hooks/useColumnAccessFilter.ts
================================================================================
*/

IF NOT EXISTS (
    SELECT 1
    FROM   sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
       AND name = N'SortOrder'
)
BEGIN
    PRINT 'Adding column [SortOrder] to [dbo].[UserGridColumnAccess]...';

    ALTER TABLE [dbo].[UserGridColumnAccess]
    ADD [SortOrder] INT NULL;

    PRINT 'Column [SortOrder] added successfully.';
END
ELSE
BEGIN
    PRINT 'Column [SortOrder] already exists on [dbo].[UserGridColumnAccess]. Skipping.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserGridColumnAccess.SortOrder migration completed.';
PRINT '================================================================================';
GO
