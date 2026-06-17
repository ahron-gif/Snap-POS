-- Chatbot tenant schema: conversations, messages, and action drafts
-- Run against each TENANT database

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversations')
BEGIN
    CREATE TABLE [dbo].[ChatConversations]
    (
        [Id]                BIGINT              IDENTITY(1,1) NOT NULL,
        [ConversationGuid]  UNIQUEIDENTIFIER    NOT NULL,
        [UserId]            INT                 NOT NULL,
        [Title]             NVARCHAR(120)       NOT NULL,
        [SummaryText]       NVARCHAR(MAX)       NULL,
        [TotalMessages]     INT                 NOT NULL DEFAULT 0,
        [TotalInputTokens]  BIGINT              NOT NULL DEFAULT 0,
        [TotalOutputTokens] BIGINT              NOT NULL DEFAULT 0,
        [IsDeleted]         BIT                 NOT NULL DEFAULT 0,
        [CreatedAt]         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_ChatConversations] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE NONCLUSTERED INDEX [UQ_ChatConversations_Guid]
        ON [dbo].[ChatConversations]([ConversationGuid]);

    CREATE NONCLUSTERED INDEX [IX_ChatConversations_User_Updated]
        ON [dbo].[ChatConversations]([UserId], [UpdatedAt]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatMessages')
BEGIN
    CREATE TABLE [dbo].[ChatMessages]
    (
        [Id]                BIGINT              IDENTITY(1,1) NOT NULL,
        [ConversationId]    BIGINT              NOT NULL,
        [Role]              INT                 NOT NULL,
        [Content]           NVARCHAR(MAX)       NOT NULL,
        [ToolName]          NVARCHAR(100)       NULL,
        [ToolCallId]        NVARCHAR(100)       NULL,
        [ToolArgumentsJson] NVARCHAR(MAX)       NULL,
        [ToolResultJson]    NVARCHAR(MAX)       NULL,
        [InputTokens]       INT                 NOT NULL DEFAULT 0,
        [OutputTokens]      INT                 NOT NULL DEFAULT 0,
        [ModelName]         NVARCHAR(100)       NULL,
        [CreatedAt]         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_ChatMessages] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_ChatMessages_ChatConversations]
            FOREIGN KEY ([ConversationId])
            REFERENCES [dbo].[ChatConversations]([Id])
            ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX [IX_ChatMessages_Conversation_Created]
        ON [dbo].[ChatMessages]([ConversationId], [CreatedAt]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatActionDrafts')
BEGIN
    CREATE TABLE [dbo].[ChatActionDrafts]
    (
        [Id]              BIGINT              IDENTITY(1,1) NOT NULL,
        [DraftGuid]       UNIQUEIDENTIFIER    NOT NULL,
        [ConversationId]  BIGINT              NULL,
        [UserId]          INT                 NOT NULL,
        [ToolName]        NVARCHAR(100)       NOT NULL,
        [PermissionKey]   NVARCHAR(150)       NOT NULL,
        [ArgumentsJson]   NVARCHAR(MAX)       NOT NULL,
        [PreviewJson]     NVARCHAR(MAX)       NOT NULL,
        [Status]          INT                 NOT NULL,
        [CreatedAt]       DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        [ExpiresAt]       DATETIME2           NOT NULL,
        [ResolvedAt]      DATETIME2           NULL,
        [ResolutionNote]  NVARCHAR(500)       NULL,
        CONSTRAINT [PK_ChatActionDrafts] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE UNIQUE NONCLUSTERED INDEX [UQ_ChatActionDrafts_Guid]
        ON [dbo].[ChatActionDrafts]([DraftGuid]);

    CREATE NONCLUSTERED INDEX [IX_ChatActionDrafts_User_Status]
        ON [dbo].[ChatActionDrafts]([UserId], [Status]);
END
GO
