namespace BackOffice.Application.DTOs.Auth;

public class ConfirmLoginRequestDto
{
    public string TemporaryToken { get; set; } = null!;
    public Guid? SessionIdToRevoke { get; set; }
}
