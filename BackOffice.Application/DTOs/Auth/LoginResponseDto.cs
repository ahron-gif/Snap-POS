namespace BackOffice.Application.DTOs.Auth;

public class LoginResponseDto
{
    public string AccessToken { get; set; } = null!;
    public string RefreshToken { get; set; } = null!;
    public string? Email { get; set; }
    public int UserId { get; set; }
    public Guid LocalUserId { get; set; }
    public string? Username { get; set; }
    public string? Role { get; set; }
    public int? CustomerId { get; set; }
    public Guid SessionId { get; set; }

    /// <summary>
    /// "ok" | "past_due" | "suspended" | "trial"
    /// </summary>
    public string BillingStatus { get; set; } = "ok";

    /// <summary>
    /// Trusted device token returned after MFA verification with "Remember device" checked.
    /// The frontend stores this in localStorage and sends it as X-Device-Token header on login.
    /// </summary>
    public string? DeviceToken { get; set; }

    /// <summary>
    /// ISO 8601 expiry of the device token. Null means it never expires.
    /// </summary>
    public string? DeviceTokenExpiresAt { get; set; }
}
