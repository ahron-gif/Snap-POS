-- Add ProfileImage column to WebAppUsers table.
--
-- Stores the S3 object key / path of the user's profile picture for the
-- BackOffice-Web self-service profile feature. This is a web-only concept:
-- the image is stored ONLY here on the authoritative app-user table. It is
-- deliberately NOT mirrored to the tenant user tables (WebUsers / Users) nor
-- to the legacy desktop AppUsers table — the desktop POS has no use for it.
--
-- On read the API turns this key into a short-lived pre-signed S3 URL
-- (see UserController.GetMyProfile / UploadProfileImage). NULL = no image.
--
-- nvarchar(1000) gives ample headroom for the "{folder}/{guid}{ext}" key.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[WebAppUsers]')
      AND name = N'ProfileImage'
)
BEGIN
    ALTER TABLE [dbo].[WebAppUsers]
        ADD [ProfileImage] NVARCHAR(1000) NULL;

    PRINT 'Added ProfileImage column to WebAppUsers table.';
END
ELSE
BEGIN
    PRINT 'ProfileImage column already exists on WebAppUsers table — skipped.';
END
GO
