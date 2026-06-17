namespace BackOffice.Application.DTOs.Auth;

public class LoginConflictResponseDto
{
    public bool RequiresConfirmation { get; set; } = true;
    public string ConflictType { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string TemporaryToken { get; set; } = null!;
    public ActiveSessionInfoDto? UserActiveSession { get; set; }
    public CustomerLimitInfoDto? CustomerLimitInfo { get; set; }
    public List<ActiveSessionDetailDto>? ActiveSessions { get; set; }
}

public class ActiveSessionInfoDto
{
    public string? DeviceInfo { get; set; }
    public string? IpAddress { get; set; }
    public DateTime LastActivityAt { get; set; }
}

public class CustomerLimitInfoDto
{
    public int MaxAllowed { get; set; }
    public int CurrentActive { get; set; }
}

public class ActiveSessionDetailDto
{
    public Guid SessionId { get; set; }
    public string? UserName { get; set; }
    public string? DeviceInfo { get; set; }
    public string? IpAddress { get; set; }
    public DateTime LastActivityAt { get; set; }
}
