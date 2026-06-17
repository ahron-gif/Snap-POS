using BackOffice.Application.DTOs.Tenant.User;
using FluentValidation;

namespace BackOffice.Application.Validators.User
{
    public class UpdateUserDtoValidator : AbstractValidator<UpdateUserDto>
    {
        public UpdateUserDtoValidator()
        {
            RuleFor(x => x.TenantUserId)
                .NotEmpty().WithMessage("Tenant user ID is required");

            RuleFor(x => x.UserName)
                .NotEmpty().WithMessage("User name is required")
                .MaximumLength(50).WithMessage("User name cannot exceed 50 characters");

            RuleFor(x => x.Password)
                .MinimumLength(6).WithMessage("Password must be at least 6 characters")
                .When(x => !string.IsNullOrEmpty(x.Password));

            RuleFor(x => x.UserFName)
                .MaximumLength(50).WithMessage("First name cannot exceed 50 characters")
                .When(x => !string.IsNullOrEmpty(x.UserFName));

            RuleFor(x => x.UserLName)
                .MaximumLength(50).WithMessage("Last name cannot exceed 50 characters")
                .When(x => !string.IsNullOrEmpty(x.UserLName));

            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("Email is required")
                .EmailAddress().WithMessage("Invalid email format");

            RuleFor(x => x.Address)
                .MaximumLength(4000).WithMessage("Address cannot exceed 4000 characters")
                .When(x => !string.IsNullOrEmpty(x.Address));

            RuleFor(x => x.HomePhoneNumber)
                .MaximumLength(50).WithMessage("Home phone cannot exceed 50 characters")
                .When(x => !string.IsNullOrEmpty(x.HomePhoneNumber));

            RuleFor(x => x.WorkPhoneNumber)
                .MaximumLength(50).WithMessage("Work phone cannot exceed 50 characters")
                .When(x => !string.IsNullOrEmpty(x.WorkPhoneNumber));

            RuleFor(x => x.Fax)
                .MaximumLength(50).WithMessage("Fax cannot exceed 50 characters")
                .When(x => !string.IsNullOrEmpty(x.Fax));

            RuleFor(x => x.ZipCode)
                .MaximumLength(50).WithMessage("Zip code cannot exceed 50 characters")
                .When(x => !string.IsNullOrEmpty(x.ZipCode));

            // Same role-list rule as CreateUserDto — applies on edit too so a
            // user can't be saved into a state with zero roles. The conditional
            // tenant/store rules live in UpdateUserAsync (DB lookup needed).
            RuleFor(x => x.RoleIds)
                .NotNull().WithMessage("At least one role must be selected.")
                .Must(r => r != null && r.Count > 0).WithMessage("At least one role must be selected.");
        }
    }
}
