-- Chatbot main-DB schema: per-tenant settings
-- Run against the MAIN database

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantChatbotSettings')
BEGIN
    CREATE TABLE [dbo].[TenantChatbotSettings]
    (
        [Id]                       INT             IDENTITY(1,1) NOT NULL,
        [CustomerId]               INT             NOT NULL,
        [IsEnabled]                BIT             NOT NULL DEFAULT 1,
        [DailyMessageCap]          INT             NOT NULL DEFAULT 500,
        [ModelTier]                NVARCHAR(20)    NOT NULL DEFAULT 'haiku',
        [MonthlyTokenBudgetCents]  BIGINT          NOT NULL DEFAULT 0,
        [CreatedAt]                DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedAt]                DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_TenantChatbotSettings] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE NONCLUSTERED INDEX [UQ_TenantChatbotSettings_CustomerId]
        ON [dbo].[TenantChatbotSettings]([CustomerId]);
END
GO
