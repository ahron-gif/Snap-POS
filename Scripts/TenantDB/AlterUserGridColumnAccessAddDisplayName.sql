/*
================================================================================
Script Name:    AlterUserGridColumnAccessAddDisplayName.sql
Description:    Adds a nullable DisplayName column to the UserGridColumnAccess
                table. Lets Super Admins override a column's header label on
                a per-user or tenant-wide basis (same row as AllowedToView).

                NULL means "use the column's default header name from the grid
                definition". A non-null value overrides the default.

Table:          dbo.UserGridColumnAccess
Database:       Tenant Database (Customer DB)

Created:        2026-04-18
Version:        1.1

Usage:
    Run this script on each tenant (customer) database AFTER the base
    CreateUserGridColumnAccessTable.sql has already run. It's idempotent —
    safe to run twice.

Related Files:
    - Base migration:     Scripts/CreateUserGridColumnAccessTable.sql
    - Backend entity:     BackOffice.Domain/Entities/Tenant/UserGridColumnAccess.cs
    - Backend DTO:        BackOffice.Application/DTOs/Tenant/GridColumnAccess/GridColumnAccessDto.cs
    - Backend service:    BackOffice.Persistence/Services/Tenant/GridColumnAccessService.cs
    - Frontend service:   BackOffice.Presentation/src/services/gridColumnAccessService.ts
    - Frontend hook:      BackOffice.Presentation/src/hooks/useColumnAccessFilter.ts
================================================================================
*/

IF NOT EXISTS (
    SELECT 1
    FROM   sys.columns
    WHERE  object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]')
       AND name = N'DisplayName'
)
BEGIN
    PRINT 'Adding column [DisplayName] to [dbo].[UserGridColumnAccess]...';

    ALTER TABLE [dbo].[UserGridColumnAccess]
    ADD [DisplayName] NVARCHAR(100) NULL;

    PRINT 'Column [DisplayName] added successfully.';
END
ELSE
BEGIN
    PRINT 'Column [DisplayName] already exists on [dbo].[UserGridColumnAccess]. Skipping.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserGridColumnAccess.DisplayName migration completed.';
PRINT '================================================================================';
GO
