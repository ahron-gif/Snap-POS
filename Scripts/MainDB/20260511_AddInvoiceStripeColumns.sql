-- =============================================
-- 20260511 - View Invoice: link Invoices to Stripe-hosted URLs
-- =============================================
-- Adds:
--   Invoices.StripeInvoiceId    -- 'in_...' from Stripe
--   Invoices.HostedInvoiceUrl   -- public Stripe-hosted invoice page
--   Invoices.InvoicePdfUrl      -- direct PDF download link
--
-- Idempotent: safe to re-run.
-- =============================================

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[Invoices]') AND name = N'StripeInvoiceId')
BEGIN
    ALTER TABLE [dbo].[Invoices] ADD [StripeInvoiceId] NVARCHAR(100) NULL;
    PRINT 'Added Invoices.StripeInvoiceId.';
END
ELSE
    PRINT 'Invoices.StripeInvoiceId already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[Invoices]') AND name = N'HostedInvoiceUrl')
BEGIN
    ALTER TABLE [dbo].[Invoices] ADD [HostedInvoiceUrl] NVARCHAR(500) NULL;
    PRINT 'Added Invoices.HostedInvoiceUrl.';
END
ELSE
    PRINT 'Invoices.HostedInvoiceUrl already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[dbo].[Invoices]') AND name = N'InvoicePdfUrl')
BEGIN
    ALTER TABLE [dbo].[Invoices] ADD [InvoicePdfUrl] NVARCHAR(500) NULL;
    PRINT 'Added Invoices.InvoicePdfUrl.';
END
ELSE
    PRINT 'Invoices.InvoicePdfUrl already exists - skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Invoices_StripeInvoiceId'
                 AND object_id = OBJECT_ID(N'[dbo].[Invoices]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Invoices_StripeInvoiceId]
        ON [dbo].[Invoices] ([StripeInvoiceId])
        WHERE [StripeInvoiceId] IS NOT NULL;
    PRINT 'Added IX_Invoices_StripeInvoiceId.';
END
ELSE
    PRINT 'IX_Invoices_StripeInvoiceId already exists - skipped.';
GO

PRINT 'Invoice-Stripe linkage migration complete.';
