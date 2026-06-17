IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserTenantAssignments')
BEGIN
    CREATE TABLE [dbo].[UserTenantAssignments] (
        [Id]         INT           IDENTITY(1,1) NOT NULL,
        [UserId]     INT           NOT NULL,
        [CustomerId] INT           NOT NULL,
        [AssignedBy] INT           NOT NULL,
        [AssignedAt] DATETIME2(7)  NOT NULL CONSTRAINT [DF_UTA_AssignedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_UserTenantAssignments]              PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_UserTenantAssignments_AppUser]      FOREIGN KEY ([UserId])     REFERENCES [dbo].[AppUser]([UserId]),
        CONSTRAINT [FK_UserTenantAssignments_Customer]     FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customer]([CustomerId]),
        CONSTRAINT [FK_UserTenatAssignments_Customer]      FOREIGN KEY ([CUstomerId]) REFERENCES
        CONSTRAINT [UQ_UserTenantAssignment_User_Customer] UNIQUE ([UserId], [CustomerId])
    );

    CREATE NONCLUSTERED INDEX [IX_UserTenantAssignment_UserId]
        ON [dbo].[UserTenantAssignments] ([UserId]);
END
