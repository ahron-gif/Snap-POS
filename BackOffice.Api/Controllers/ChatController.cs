using System;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IChatActionDraftService _draftService;
        private readonly IChatbotSettingsService _settingsService;

        public ChatController(
            IChatService chatService,
            IChatActionDraftService draftService,
            IChatbotSettingsService settingsService)
        {
            _chatService = chatService;
            _draftService = draftService;
            _settingsService = settingsService;
        }

        [HttpPost("messages")]
        public async Task<IActionResult> SendMessage([FromBody] ChatMessageRequestDto request, CancellationToken ct)
        {
            if (!TryGetContext(out var userId, out var customerId, out var errorResult))
                return errorResult!;

            var response = await _chatService.SendMessageAsync(userId, customerId, request, ct);
            return Ok(response);
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> ListConversations(CancellationToken ct)
        {
            if (!TryGetContext(out var userId, out _, out var errorResult))
                return errorResult!;

            var response = await _chatService.ListConversationsAsync(userId, ct);
            return Ok(response);
        }

        [HttpGet("conversations/{conversationGuid:guid}")]
        public async Task<IActionResult> GetConversation(Guid conversationGuid, CancellationToken ct)
        {
            if (!TryGetContext(out var userId, out _, out var errorResult))
                return errorResult!;

            var response = await _chatService.GetConversationAsync(userId, conversationGuid, ct);
            return Ok(response);
        }

        [HttpDelete("conversations/{conversationGuid:guid}")]
        public async Task<IActionResult> DeleteConversation(Guid conversationGuid, CancellationToken ct)
        {
            if (!TryGetContext(out var userId, out _, out var errorResult))
                return errorResult!;

            var response = await _chatService.DeleteConversationAsync(userId, conversationGuid, ct);
            return Ok(response);
        }

        [HttpPost("drafts/{draftGuid:guid}/confirm")]
        public async Task<IActionResult> ConfirmDraft(Guid draftGuid, [FromBody] ChatDraftConfirmRequestDto? body, CancellationToken ct)
        {
            if (!TryGetContext(out var userId, out var customerId, out var errorResult))
                return errorResult!;

            var response = await _draftService.ConfirmAsync(draftGuid, userId, customerId, body?.Note, ct);
            return Ok(response);
        }


        [HttpPost("drafts/{draftGuid:guid}/reject")]
        public async Task<IActionResult> RejectDraft(Guid draftGuid, [FromBody] ChatDraftRejectRequestDto? body, CancellationToken ct)
        {
            if (!TryGetContext(out var userId, out _, out var errorResult))
                return errorResult!;

            var response = await _draftService.RejectAsync(draftGuid, userId, body?.Reason, ct);
            return Ok(response);
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings(CancellationToken ct)
        {
            if (!TryGetContext(out _, out var customerId, out var errorResult))
                return errorResult!;

            var dto = await _settingsService.GetForTenantAsync(customerId, ct);
            return Ok(ApiResponseFactory.Success(dto));
        }

        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] ChatbotSettingsDto dto, CancellationToken ct)
        {
            if (!TryGetContext(out _, out var customerId, out var errorResult))
                return errorResult!;

            var response = await _settingsService.UpdateAsync(customerId, dto, ct);
            return Ok(response);
        }

        private bool TryGetContext(out int userId, out int customerId, out IActionResult? errorResult)
        {
            userId = 0;
            customerId = 0;
            errorResult = null;

            var userIdClaim = User.FindFirst("UserId")?.Value;

            if (!int.TryParse(userIdClaim, out userId) || userId <= 0)
            {
                errorResult = Unauthorized(ApiResponseFactory.Unauthorized<object>("Missing user context."));
                return false;
            }

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!int.TryParse(customerIdClaim, out customerId) || customerId <= 0)
            {
                var headerCustomerId = Request.Headers["customerid"].ToString();
                if (!int.TryParse(headerCustomerId, out customerId) || customerId <= 0)
                {
                    errorResult = Unauthorized(ApiResponseFactory.Unauthorized<object>("Missing tenant context. Select a tenant first."));
                    return false;
                }
            }

            return true;
        }
    }
}
