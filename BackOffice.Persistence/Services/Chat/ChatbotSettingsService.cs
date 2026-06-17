using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Services.Chat;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BackOffice.Persistence.Services.Chat
{
    public class ChatbotSettingsService : IChatbotSettingsService
    {
        private readonly MainDBContext _mainDb;
        private readonly TenantDBContext _tenantDb;
        private readonly ChatLimitsOptions _limits;

        public ChatbotSettingsService(
            MainDBContext mainDb,
            TenantDBContext tenantDb,
            IOptions<ChatLimitsOptions> limits)
        {
            _mainDb = mainDb;
            _tenantDb = tenantDb;
            _limits = limits.Value;
        }

        public async Task<ChatbotSettingsDto> GetForTenantAsync(int customerId, CancellationToken ct = default)
        {
            var row = await _mainDb.Set<TenantChatbotSettings>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CustomerId == customerId, ct);

            if (row == null)
            {
                return new ChatbotSettingsDto
                {
                    CustomerId = customerId,
                    IsEnabled = true,
                    DailyMessageCap = _limits.DefaultDailyMessageCap,
                    ModelTier = "haiku",
                    MonthlyTokenBudgetCents = 0
                };
            }

            return new ChatbotSettingsDto
            {
                CustomerId = row.CustomerId,
                IsEnabled = row.IsEnabled,
                DailyMessageCap = row.DailyMessageCap,
                ModelTier = row.ModelTier,
                MonthlyTokenBudgetCents = row.MonthlyTokenBudgetCents
            };
        }

        public async Task<ApiResponse<ChatbotSettingsDto>> UpdateAsync(int customerId, ChatbotSettingsDto dto, CancellationToken ct = default)
        {
            var row = await _mainDb.Set<TenantChatbotSettings>()
                .FirstOrDefaultAsync(x => x.CustomerId == customerId, ct);

            var now = DateTime.UtcNow;
            if (row == null)
            {
                row = new TenantChatbotSettings
                {
                    CustomerId = customerId,
                    CreatedAt = now
                };
                await _mainDb.Set<TenantChatbotSettings>().AddAsync(row, ct);
            }

            row.IsEnabled = dto.IsEnabled;
            row.DailyMessageCap = dto.DailyMessageCap <= 0 ? _limits.DefaultDailyMessageCap : dto.DailyMessageCap;
            row.ModelTier = string.IsNullOrWhiteSpace(dto.ModelTier) ? "haiku" : dto.ModelTier;
            row.MonthlyTokenBudgetCents = dto.MonthlyTokenBudgetCents;
            row.UpdatedAt = now;

            await _mainDb.SaveChangesAsync(ct);

            return ApiResponseFactory.Success(new ChatbotSettingsDto
            {
                CustomerId = row.CustomerId,
                IsEnabled = row.IsEnabled,
                DailyMessageCap = row.DailyMessageCap,
                ModelTier = row.ModelTier,
                MonthlyTokenBudgetCents = row.MonthlyTokenBudgetCents
            });
        }

        public async Task<bool> IsWithinDailyCapAsync(int customerId, CancellationToken ct = default)
        {
            var cap = (await GetForTenantAsync(customerId, ct)).DailyMessageCap;
            if (cap <= 0) return true;

            var startOfDay = DateTime.UtcNow.Date;
            var count = await _tenantDb.Set<BackOffice.Domain.Entities.Tenant.Chat.ChatMessage>()
                .AsNoTracking()
                .Where(m => m.CreatedAt >= startOfDay && m.Role == BackOffice.Domain.Enums.ChatRole.User)
                .CountAsync(ct);

            return count < cap;
        }
    }
}
