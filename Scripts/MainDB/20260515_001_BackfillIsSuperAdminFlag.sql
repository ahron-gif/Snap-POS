-- =============================================================================
-- 20260515_001_BackfillIsSuperAdminFlag.sql
--
-- One-time data migration. The IsSuperAdmin column already exists on
-- WebAppUsers (created 2026-05-08), but the auth flow keyed super-admin role
-- off CustomerId IS NULL. We're moving that decision onto the IsSuperAdmin
-- flag so a user with a CustomerId can also be a super-admin.
--
-- Scope: WEB ONLY. The legacy AppUsers table is left untouched — the desktop
-- POS does not consume IsSuperAdmin and we don't want to drift it.
--
-- This script backfills the flag for every existing user that the legacy
-- "CustomerId IS NULL" check would have considered a super-admin, so the
-- switchover is a no-op for them. Idempotent — re-running is safe.
--
-- Apply to: MAIN DB
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

BEGIN TRY
    UPDATE [dbo].[WebAppUsers]
    SET [IsSuperAdmin] = 1
    WHERE [CustomerId] IS NULL
      AND ([IsSuperAdmin] IS NULL OR [IsSuperAdmin] = 0);

    DECLARE @WebAppUsersUpdated INT = @@ROWCOUNT;

    COMMIT TRANSACTION;

    PRINT CONCAT('Backfilled IsSuperAdmin=1 for ', @WebAppUsersUpdated, ' WebAppUsers row(s).');
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
