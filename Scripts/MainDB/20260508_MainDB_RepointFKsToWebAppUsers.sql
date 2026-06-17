-- =============================================================================
-- 20260508_MainDB_RepointFKsToWebAppUsers.sql
-- Target DB: Main database
--
-- Repoints every foreign key that currently references [dbo].[AppUsers].[UserId]
-- so it instead references [dbo].[WebAppUsers].[UserId].
--
-- Why: web-only tables (UserSessions, UserMfaSettings, MfaChallenges, MfaOtpCodes,
-- MfaTrustedDevices, MfaAttemptLogs, PasswordResetTokens, AppUserGlobalRoles,
-- UserTenantAssignments, UserEnvironments) are written exclusively by
-- BackOffice-Web. After the EF mapping flips to WebAppUsers, new users live in
-- WebAppUsers only - existing FKs that still reference AppUsers would block
-- inserts. Cloud_BackOffice does not write any of these tables, so repointing
-- is safe for the desktop app.
--
-- Run AFTER 20260508_MainDB_CreateWebAppUsers.sql (data must already be copied).
--
-- Strategy:
--   1. Enumerate every FK referencing dbo.AppUsers (single-column, on UserId).
--   2. For each: drop it and recreate the same FK pointing at WebAppUsers,
--      preserving constraint name, ON DELETE / ON UPDATE actions, and NOCHECK
--      state.
--
-- Re-runnable: only acts on FKs that still reference AppUsers.
-- Review the printed plan before COMMIT.
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- Sanity: WebAppUsers must exist.
IF OBJECT_ID(N'[dbo].[WebAppUsers]', N'U') IS NULL
BEGIN
    RAISERROR (N'WebAppUsers does not exist. Run 20260508_MainDB_CreateWebAppUsers.sql first.', 16, 1);
    RETURN;
END
GO

BEGIN TRANSACTION RepointFKs;

BEGIN TRY
    -- Collect FKs that reference AppUsers and are simple (single-column) FKs on UserId.
    -- (None of the in-scope web-only tables use multi-column FKs to AppUsers.)
    DECLARE @plan TABLE
    (
        FkName              sysname        NOT NULL,
        ParentSchema        sysname        NOT NULL,
        ParentTable         sysname        NOT NULL,
        ParentColumn        sysname        NOT NULL,
        DeleteActionDesc    nvarchar(60)   NOT NULL,
        UpdateActionDesc    nvarchar(60)   NOT NULL,
        IsNotForReplication  bit           NOT NULL,
        IsDisabled          bit            NOT NULL,
        IsNotTrusted        bit            NOT NULL
    );

    INSERT INTO @plan
        (FkName, ParentSchema, ParentTable, ParentColumn,
         DeleteActionDesc, UpdateActionDesc, IsNotForReplication, IsDisabled, IsNotTrusted)
    SELECT
           fk.name,
           ps.name,
           pt.name,
           pc.name,
           fk.delete_referential_action_desc,
           fk.update_referential_action_desc,
           fk.is_not_for_replication,
           fk.is_disabled,
           fk.is_not_trusted
    FROM   sys.foreign_keys fk
           INNER JOIN sys.tables   pt ON fk.parent_object_id     = pt.object_id
           INNER JOIN sys.schemas  ps ON pt.schema_id            = ps.schema_id
           INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
           INNER JOIN sys.columns  pc ON fkc.parent_object_id    = pc.object_id
                                     AND fkc.parent_column_id   = pc.column_id
    WHERE  fk.referenced_object_id = OBJECT_ID(N'[dbo].[AppUsers]')
      AND  NOT EXISTS (
              SELECT 1
              FROM   sys.foreign_key_columns fkc2
              WHERE  fkc2.constraint_object_id = fk.object_id
                AND  fkc2.constraint_column_id > 1
           ); -- exclude composite FKs (none expected, but defensive)

    -- Print plan for review
    SELECT 'WILL REPOINT' AS Action, FkName, ParentSchema, ParentTable, ParentColumn,
           DeleteActionDesc, UpdateActionDesc, IsDisabled, IsNotTrusted
    FROM   @plan
    ORDER BY ParentTable, FkName;

    DECLARE @fk           sysname,
            @schema       sysname,
            @table        sysname,
            @column       sysname,
            @deleteAction nvarchar(60),
            @updateAction nvarchar(60),
            @isDisabled   bit,
            @isNotTrusted bit,
            @sql          nvarchar(max);

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT FkName, ParentSchema, ParentTable, ParentColumn,
               DeleteActionDesc, UpdateActionDesc, IsDisabled, IsNotTrusted
        FROM   @plan;

    OPEN cur;
    FETCH NEXT FROM cur INTO @fk, @schema, @table, @column, @deleteAction, @updateAction, @isDisabled, @isNotTrusted;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- 1. Drop the existing FK (still referencing AppUsers)
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
                 + N' DROP CONSTRAINT ' + QUOTENAME(@fk) + N';';
        PRINT @sql;
        EXEC sp_executesql @sql;

        -- 2. Recreate the FK against WebAppUsers, preserving same name + actions
        SET @sql =
              N'ALTER TABLE ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
            + CASE WHEN @isNotTrusted = 1 THEN N' WITH NOCHECK' ELSE N' WITH CHECK' END
            + N' ADD CONSTRAINT ' + QUOTENAME(@fk)
            + N' FOREIGN KEY (' + QUOTENAME(@column) + N')'
            + N' REFERENCES [dbo].[WebAppUsers] ([UserId])'
            + CASE @deleteAction
                  WHEN N'CASCADE'     THEN N' ON DELETE CASCADE'
                  WHEN N'SET_NULL'    THEN N' ON DELETE SET NULL'
                  WHEN N'SET_DEFAULT' THEN N' ON DELETE SET DEFAULT'
                  ELSE N''
              END
            + CASE @updateAction
                  WHEN N'CASCADE'     THEN N' ON UPDATE CASCADE'
                  WHEN N'SET_NULL'    THEN N' ON UPDATE SET NULL'
                  WHEN N'SET_DEFAULT' THEN N' ON UPDATE SET DEFAULT'
                  ELSE N''
              END
            + N';';
        PRINT @sql;
        EXEC sp_executesql @sql;

        -- 3. Re-disable if it was disabled
        IF @isDisabled = 1
        BEGIN
            SET @sql = N'ALTER TABLE ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
                     + N' NOCHECK CONSTRAINT ' + QUOTENAME(@fk) + N';';
            PRINT @sql;
            EXEC sp_executesql @sql;
        END

        FETCH NEXT FROM cur INTO @fk, @schema, @table, @column, @deleteAction, @updateAction, @isDisabled, @isNotTrusted;
    END

    CLOSE cur;
    DEALLOCATE cur;

    DECLARE @repointed INT = (SELECT COUNT(*) FROM @plan);
    PRINT CONCAT('Repointed ', @repointed, ' FK(s) from AppUsers to WebAppUsers.');

    COMMIT TRANSACTION RepointFKs;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION RepointFKs;

    DECLARE @errMsg nvarchar(4000) = ERROR_MESSAGE(),
            @errSev int           = ERROR_SEVERITY(),
            @errSt  int           = ERROR_STATE();
    RAISERROR (@errMsg, @errSev, @errSt);
END CATCH
GO

-- -----------------------------------------------------------------------------
-- Verification: list any FK that STILL references AppUsers.
-- Expected result: empty.
-- -----------------------------------------------------------------------------
SELECT  fk.name           AS RemainingFK,
        OBJECT_NAME(fk.parent_object_id) AS ParentTable
FROM    sys.foreign_keys fk
WHERE   fk.referenced_object_id = OBJECT_ID(N'[dbo].[AppUsers]');
GO
