#nullable enable
using BackOffice.Domain.Entities.Tenant.Chat;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Tenant
{
    public partial class TenantDBContext
    {
        public virtual DbSet<ChatConversation> ChatConversations { get; set; }
        public virtual DbSet<ChatMessage> ChatMessages { get; set; }
        public virtual DbSet<ChatActionDraft> ChatActionDrafts { get; set; }

        internal void ConfigureChatEntities(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ChatConversation>(entity =>
            {
                entity.ToTable("ChatConversations");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();

                entity.Property(e => e.ConversationGuid).IsRequired();
                entity.Property(e => e.UserId).IsRequired();
                entity.Property(e => e.Title).IsRequired().HasMaxLength(120);
                entity.Property(e => e.SummaryText).HasColumnType("nvarchar(max)");
                entity.Property(e => e.IsDeleted).HasDefaultValue(false);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

                entity.HasIndex(e => e.ConversationGuid)
                    .IsUnique()
                    .HasDatabaseName("UQ_ChatConversations_Guid");

                entity.HasIndex(e => new { e.UserId, e.UpdatedAt })
                    .HasDatabaseName("IX_ChatConversations_User_Updated");
            });

            modelBuilder.Entity<ChatMessage>(entity =>
            {
                entity.ToTable("ChatMessages");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();

                entity.Property(e => e.ConversationId).IsRequired();
                entity.Property(e => e.Role).IsRequired().HasConversion<int>();
                entity.Property(e => e.Content).IsRequired().HasColumnType("nvarchar(max)");
                entity.Property(e => e.ToolName).HasMaxLength(100);
                entity.Property(e => e.ToolCallId).HasMaxLength(100);
                entity.Property(e => e.ToolArgumentsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.ToolResultJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.ModelName).HasMaxLength(100);
                entity.Property(e => e.VisualizationsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.LinksJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.SuggestedFollowUpsJson).HasColumnType("nvarchar(max)");
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

                entity.HasOne(e => e.Conversation)
                    .WithMany(c => c.Messages)
                    .HasForeignKey(e => e.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => new { e.ConversationId, e.CreatedAt })
                    .HasDatabaseName("IX_ChatMessages_Conversation_Created");
            });

            modelBuilder.Entity<ChatActionDraft>(entity =>
            {
                entity.ToTable("ChatActionDrafts");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();

                entity.Property(e => e.DraftGuid).IsRequired();
                entity.Property(e => e.UserId).IsRequired();
                entity.Property(e => e.ToolName).IsRequired().HasMaxLength(100);
                entity.Property(e => e.PermissionKey).IsRequired().HasMaxLength(150);
                entity.Property(e => e.ArgumentsJson).IsRequired().HasColumnType("nvarchar(max)");
                entity.Property(e => e.PreviewJson).IsRequired().HasColumnType("nvarchar(max)");
                entity.Property(e => e.Status).IsRequired().HasConversion<int>();
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.ResolutionNote).HasMaxLength(500);

                entity.HasIndex(e => e.DraftGuid)
                    .IsUnique()
                    .HasDatabaseName("UQ_ChatActionDrafts_Guid");

                entity.HasIndex(e => new { e.UserId, e.Status })
                    .HasDatabaseName("IX_ChatActionDrafts_User_Status");
            });
        }
    }
}
