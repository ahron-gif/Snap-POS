namespace BackOffice.Application.DTOs.Main.SmtpSettings;

public class SmtpSettingsDto
{
    public int CustomerId { get; set; }
    public Guid StoreId { get; set; }
    public string? Host { get; set; }
    public int? Port { get; set; }
    public bool UseSsl { get; set; }
    public string? EmailAddress { get; set; }
    public string? Password { get; set; }
    public string? StoreEmail { get; set; }
    public bool IsComplete { get; set; }
    public string Source { get; set; } = "none"; // store | global | appsettings | none
}

public class SmtpSettingsUpdateDto
{
    public Guid StoreId { get; set; }
    public string? Host { get; set; }
    public int? Port { get; set; }
    public bool UseSsl { get; set; }
    public string? EmailAddress { get; set; }
    public string? Password { get; set; }
    public string? StoreEmail { get; set; }
}

public class SmtpStoreLookupDto
{
    public Guid StoreId { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public bool IsMainStore { get; set; }
}
