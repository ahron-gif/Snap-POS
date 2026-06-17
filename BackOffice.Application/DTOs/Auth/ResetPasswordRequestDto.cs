namespace BackOffice.Application.DTOs.Auth;

public class ResetPasswordRequestDto
{
    public string Token { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
    public string ConfirmPassword { get; set; } = null!;
}
