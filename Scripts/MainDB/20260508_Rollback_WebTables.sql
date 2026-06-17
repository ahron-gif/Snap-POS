-- =============================================================================
-- 20260508_Rollback_WebTables.sql
-- Reverses the WebUsers / WebUsersStore / WebAppUsers migration.
--
-- IMPORTANT: This rollback assumes that the data in the Web* tables has not
-- diverged from the originals. If new web users have been created since
-- migration, those rows will be LOST when this script drops the Web* tables.
-- Take a backup or export Web* rows first if you need to preserve them.
--
-- Run order:
--   1. (Optional) On Main DB: re-point any FKs that were moved back to AppUsers.
--      The dynamic block at the bottom does this automatically.
--   2. Drop the Web* views, then tables.
--
-- Sections:
--   * MAIN DB section - run on the Main database
--   * TENANT DB section - run on each tenant database
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- =============================================================================
-- MAIN DB - run on the Main database
-- =============================================================================

-- 1. Re-point FKs from WebAppUsers back to AppUsers (mirror of repoint script)
IF OBJECT_ID(N'[dbo].[WebAppUsers]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[AppUsers]',   N'U') IS NOT NULL
BEGIN
    BEGIN TRANSACTION RollbackFKs;

    BEGIN TRY
        DECLARE @plan TABLE
        (
            FkName              sysname        NOT NULL,
            ParentSchema        sysname        NOT NULL,
            ParentTable         sysname        NOT NULL,
            ParentColumn        sysname        NOT NULL,
            DeleteActionDesc    nvarchar(60)   NOT NULL,
            UpdateActionDesc    nvarchar(60)   NOT NULL,
            IsDisabled          bit            NOT NULL,
            IsNotTrusted        bit            NOT NULL
        );

        INSERT INTO @plan
        SELECT fk.name, ps.name, pt.name, pc.name,
               fk.delete_referential_action_desc,
               fk.update_referential_action_desc,
               fk.is_disabled,
               fk.is_not_trusted
        FROM   sys.foreign_keys fk
               INNER JOIN sys.tables   pt ON fk.parent_object_id     = pt.object_id
               INNER JOIN sys.schemas  ps ON pt.schema_id            = ps.schema_id
               INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
               INNER JOIN sys.columns  pc ON fkc.parent_object_id    = pc.object_id
                                         AND fkc.parent_column_id   = pc.column_id
        WHERE  fk.referenced_object_id = OBJECT_ID(N'[dbo].[WebAppUsers]')
          AND  NOT EXISTS (SELECT 1 FROM sys.foreign_key_columns fkc2
                           WHERE fkc2.constraint_object_id = fk.object_id
                             AND fkc2.constraint_column_id > 1);

        DECLARE @fk sysname, @schema sysname, @table sysname, @column sysname,
                @deleteAction nvarchar(60), @updateAction nvarchar(60),
                @isDisabled bit, @isNotTrusted bit, @sql nvarchar(max);

        DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
            SELECT FkName, ParentSchema, ParentTable, ParentColumn,
                   DeleteActionDesc, UpdateActionDesc, IsDisabled, IsNotTrusted
            FROM   @plan;

        OPEN cur;
        FETCH NEXT FROM cur INTO @fk, @schema, @table, @column, @deleteAction, @updateAction, @isDisabled, @isNotTrusted;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @sql = N'ALTER TABLE ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
                     + N' DROP CONSTRAINT ' + QUOTENAME(@fk) + N';';
            EXEC sp_executesql @sql;

            SET @sql =
                  N'ALTER TABLE ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
                + CASE WHEN @isNotTrusted = 1 THEN N' WITH NOCHECK' ELSE N' WITH CHECK' END
                + N' ADD CONSTRAINT ' + QUOTENAME(@fk)
                + N' FOREIGN KEY (' + QUOTENAME(@column) + N')'
                + N' REFERENCES [dbo].[AppUsers] ([UserId])'
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
            EXEC sp_executesql @sql;

            IF @isDisabled = 1
            BEGIN
                SET @sql = N'ALTER TABLE ' + QUOTENAME(@schema) + N'.' + QUOTENAME(@table)
                         + N' NOCHECK CONSTRAINT ' + QUOTENAME(@fk) + N';';
                EXEC sp_executesql @sql;
            END

            FETCH NEXT FROM cur INTO @fk, @schema, @table, @column, @deleteAction, @updateAction, @isDisabled, @isNotTrusted;
        END

        CLOSE cur;
        DEALLOCATE cur;

        COMMIT TRANSACTION RollbackFKs;
        PRINT 'Rolled back FKs from WebAppUsers to AppUsers.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION RollbackFKs;
        DECLARE @errMsg nvarchar(4000) = ERROR_MESSAGE(),
                @errSev int = ERROR_SEVERITY(),
                @errSt  int = ERROR_STATE();
        RAISERROR (@errMsg, @errSev, @errSt);
    END CATCH
END
GO

-- 2. Drop WebAppUsers
IF OBJECT_ID(N'[dbo].[WebAppUsers]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[WebAppUsers];
    PRINT 'Dropped WebAppUsers.';
END
GO


-- =============================================================================
-- TENANT DB - run on each tenant database
-- =============================================================================

-- 1. Drop the views first (dependency on tables)
IF OBJECT_ID(N'[dbo].[WebUsersStoreView]', N'V') IS NOT NULL
BEGIN
    DROP VIEW [dbo].[WebUsersStoreView];
    PRINT 'Dropped WebUsersStoreView.';
END
GO
z
IF OBJECT_ID(N'[dbo].[WebUsersView]', N'V') IS NOT NULL
BEGIN
    DROP VIEW [dbo].[WebUsersView];
    PRINT 'Dropped WebUsersView.';
END
GO

-- 2. Drop trigger explicitly (also dropped by DROP TABLE, but keep idempotent)
IF OBJECT_ID(N'[dbo].[Tr_DeletetWebUser]', N'TR') IS NOT NULL
BEGIN
    DROP TRIGGER [dbo].[Tr_DeletetWebUser];
    PRINT 'Dropped Tr_DeletetWebUser.';
END
GO

-- 3. Drop WebUsersStore (FK to WebUsers must drop first)
IF OBJECT_ID(N'[dbo].[WebUsersStore]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[WebUsersStore];
    PRINT 'Dropped WebUsersStore.';
END
GO

-- 4. Drop WebUsers
IF OBJECT_ID(N'[dbo].[WebUsers]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[WebUsers];
    PRINT 'Dropped WebUsers.';
END
GO
