-- =============================================================================
-- 20260420_SeedGlobalSmtpSetupValues.sql
--
-- Seeds SetUpValues rows for the global default (StoreID = 00000000-...-000)
-- for the SMTP-related OptionIDs used by BackOffice-Web's SmtpSettingsResolver
-- and the legacy BackOffice's SmtpResolver / UCGeneralEmailAccount.
--
-- Idempotent: INSERT only runs when the (StoreID, OptionID) row is missing.
-- Safe to re-run. Does NOT overwrite existing store-specific or existing
-- global rows — only fills gaps.
--
-- OptionIDs:
--   123 = Outgoing mail server
--   125 = Outgoing mail port number
--   126 = Use SSL
--   127 = Email Address (SMTP Username)
--   128 = Email Password
--   834 = Store Email
--
-- Run against each tenant database (SetUpValues table lives in the tenant DB).
-- =============================================================================

SET NOCOUNT ON;
DECLARE @GlobalStoreId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000000';
DECLARE @Now DATETIME = GETUTCDATE();

-- Guard: table must exist
IF OBJECT_ID(N'dbo.SetUpValues', N'U') IS NULL
BEGIN
    PRINT 'dbo.SetUpValues not found — skipping seed.';
    RETURN;
END;

-- OptionID 123 — Outgoing mail server
IF NOT EXISTS (SELECT 1 FROM dbo.SetUpValues WHERE StoreID = @GlobalStoreId AND OptionID = 123)
    INSERT INTO dbo.SetUpValues (OptionID, StoreID, OptionName, OptionValue, Status, DateCreated, DateModified)
    VALUES (123, @GlobalStoreId, N'BO Outgoing mail server', N'', 1, @Now, @Now);

-- OptionID 125 — Outgoing mail port number
IF NOT EXISTS (SELECT 1 FROM dbo.SetUpValues WHERE StoreID = @GlobalStoreId AND OptionID = 125)
    INSERT INTO dbo.SetUpValues (OptionID, StoreID, OptionName, OptionValue, Status, DateCreated, DateModified)
    VALUES (125, @GlobalStoreId, N'BO Outgoing mail port number', N'587', 1, @Now, @Now);

-- OptionID 126 — Use SSL
IF NOT EXISTS (SELECT 1 FROM dbo.SetUpValues WHERE StoreID = @GlobalStoreId AND OptionID = 126)
    INSERT INTO dbo.SetUpValues (OptionID, StoreID, OptionName, OptionValue, Status, DateCreated, DateModified)
    VALUES (126, @GlobalStoreId, N'BO Use SSL', N'0', 1, @Now, @Now);

-- OptionID 127 — Email Address
IF NOT EXISTS (SELECT 1 FROM dbo.SetUpValues WHERE StoreID = @GlobalStoreId AND OptionID = 127)
    INSERT INTO dbo.SetUpValues (OptionID, StoreID, OptionName, OptionValue, Status, DateCreated, DateModified)
    VALUES (127, @GlobalStoreId, N'BO Email Address', N'', 1, @Now, @Now);

-- OptionID 128 — Email Password
IF NOT EXISTS (SELECT 1 FROM dbo.SetUpValues WHERE StoreID = @GlobalStoreId AND OptionID = 128)
    INSERT INTO dbo.SetUpValues (OptionID, StoreID, OptionName, OptionValue, Status, DateCreated, DateModified)
    VALUES (128, @GlobalStoreId, N'BO Email Password', N'', 1, @Now, @Now);

-- OptionID 834 — Store Email
IF NOT EXISTS (SELECT 1 FROM dbo.SetUpValues WHERE StoreID = @GlobalStoreId AND OptionID = 834)
    INSERT INTO dbo.SetUpValues (OptionID, StoreID, OptionName, OptionValue, Status, DateCreated, DateModified)
    VALUES (834, @GlobalStoreId, N'Store Email', N'', 1, @Now, @Now);

PRINT 'Global SMTP SetUpValues seed complete.';
