/*
================================================================================
Stored Procedure: dbo.SP_OnboardNewTenant
================================================================================
Run against: MASTER DATABASE (RDTCloud / MainDB)

Purpose:
  Seeds the tenant permission ceiling (Modules + Permissions) in the Master DB.
  This is Step 1 of onboarding. Step 2 (admin role + user assignment in the
  Tenant DB) is handled by the C# API:
    POST /api/TenantRbac/InitializeAdmin { TenantId, AdminUserId }

  The C# service is Azure SQL compatible because it uses EF Core with separate
  DbContexts (MainDBContext + TenantDBContext) — no cross-database SQL needed.

Parameters:
  @TenantId       INT   — The CustomerId of the tenant (required)

Usage:
  -- Seed ceiling for tenant 92:
  EXEC dbo.SP_OnboardNewTenant @TenantId = 92;

  -- Then call the API to initialize admin role in the Tenant DB:
  -- POST /api/TenantRbac/InitializeAdmin { "tenantId": 92, "adminUserId": 15 }

Idempotent: Safe to run multiple times — skips already-existing records.
AZURE SQL COMPATIBLE — no cross-database queries.
================================================================================
*/

IF OBJECT_ID('dbo.SP_OnboardNewTenant', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_OnboardNewTenant;
GO

CREATE PROCEDURE dbo.SP_OnboardNewTenant
    @TenantId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    PRINT '================================================================';
    PRINT '  SP_OnboardNewTenant — Seed Permission Ceiling';
    PRINT '  TenantId: ' + CAST(@TenantId AS VARCHAR(10));
    PRINT '  Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
    PRINT '================================================================';

    -- Validate tenant exists
    DECLARE @TenantName NVARCHAR(200);
    SELECT @TenantName = CompanyName FROM dbo.Customers WHERE CustomerId = @TenantId;

    IF @TenantName IS NULL
    BEGIN
        RAISERROR('Tenant %d does not exist in dbo.Customers.', 16, 1, @TenantId);
        RETURN 1;
    END

    PRINT '  Tenant: ' + @TenantName;
    PRINT '';

    BEGIN TRY
    BEGIN TRANSACTION;

    -- Step 1: Enable all active modules
    INSERT INTO dbo.TenantAllowedModules (TenantId, ModuleId, IsEnabled, EnabledAt)
    SELECT @TenantId, m.ModuleId, 1, SYSUTCDATETIME()
    FROM dbo.Modules m
    WHERE m.IsActive = 1
      AND NOT EXISTS (
          SELECT 1 FROM dbo.TenantAllowedModules tam
          WHERE tam.TenantId = @TenantId AND tam.ModuleId = m.ModuleId
      );
    DECLARE @ModsInserted INT = @@ROWCOUNT;
    PRINT '  Modules enabled: ' + CAST(@ModsInserted AS VARCHAR(10)) + ' new';

    -- Step 2: Grant all active permissions in ceiling
    INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed, GrantedAt)
    SELECT @TenantId, p.Id, 1, SYSUTCDATETIME()
    FROM dbo.Permissions p
    WHERE p.IsActive = 1
      AND NOT EXISTS (
          SELECT 1 FROM dbo.TenantAllowedPermissions tap
          WHERE tap.TenantId = @TenantId AND tap.PermissionId = p.Id
      );
    DECLARE @PermsInserted INT = @@ROWCOUNT;
    PRINT '  Permissions seeded: ' + CAST(@PermsInserted AS VARCHAR(10)) + ' new';

    COMMIT TRANSACTION;

    -- Verification
    DECLARE @TotalModules INT, @TotalPerms INT;
    SELECT @TotalModules = COUNT(*) FROM dbo.TenantAllowedModules WHERE TenantId = @TenantId;
    SELECT @TotalPerms   = COUNT(*) FROM dbo.TenantAllowedPermissions WHERE TenantId = @TenantId;

    PRINT '';
    PRINT '  RESULT:';
    PRINT '    Total modules enabled: ' + CAST(@TotalModules AS VARCHAR(10));
    PRINT '    Total permissions in ceiling: ' + CAST(@TotalPerms AS VARCHAR(10));
    PRINT '';
    PRINT '  NEXT STEP:';
    PRINT '    Call POST /api/TenantRbac/InitializeAdmin';
    PRINT '    Body: { "tenantId": ' + CAST(@TenantId AS VARCHAR(10)) + ', "adminUserId": <userId> }';
    PRINT '    This creates the admin role + permissions + user assignment in the Tenant DB.';
    PRINT '================================================================';

    RETURN 0;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        PRINT 'ERROR: ' + ERROR_MESSAGE();
        THROW;
    END CATCH;
END
GO

-- ============================================================================
-- Quick test: Seed ceiling for Tenant 92
-- ============================================================================
-- EXEC dbo.SP_OnboardNewTenant @TenantId = 92;
-- GO
