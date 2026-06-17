using BackOffice.Application.DTOs.Chat;
using FluentValidation;

namespace BackOffice.Application.Validators.Chat
{
    public class ChatMessageRequestValidator : AbstractValidator<ChatMessageRequestDto>
    {
        public ChatMessageRequestValidator()
        {
            RuleFor(x => x.Content)
                .NotEmpty().WithMessage("Message content is required.")
                .MaximumLength(4000).WithMessage("Message too long. Keep under 4000 characters.");
        }
    }
}
