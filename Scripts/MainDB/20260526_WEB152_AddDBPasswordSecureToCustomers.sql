-- WEB-152: Add DBPasswordSecure column to Customers table.
--
-- Stores the AES-GCM encrypted form of the tenant DB password. The legacy
-- plaintext DBPass column is left in place because the old BackOffice app
-- still reads from it. This new column is the authoritative source for the
-- new BackOffice-Web app — it reads from DBPasswordSecure and falls back to
-- DBPass only for legacy customers that haven't been re-saved yet.
--
-- Encrypted value format produced by AesPasswordCipher:
--   base64( IV (12 bytes) || ciphertext || GCM tag (16 bytes) )
-- For a 64-character plaintext password, ciphertext is ~120 base64 chars.
-- 500 chars gives headroom for longer passwords without ever truncating.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Customers]')
      AND name = N'DBPasswordSecure'
)
BEGIN
    ALTER TABLE [dbo].[Customers]
        ADD [DBPasswordSecure] NVARCHAR(500) NULL;

    PRINT 'Added DBPasswordSecure column to Customers table.';
END
ELSE
BEGIN
    PRINT 'DBPasswordSecure column already exists on Customers table — skipped.';
END
GO
