namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Request body for PUT /api/Mfa/config/{key}.
/// </summary>
public class UpdateConfigDto
{
    public string Value { get; set; } = null!;
}
