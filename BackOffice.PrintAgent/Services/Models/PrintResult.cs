namespace BackOffice.PrintAgent.Services.Models;

public class PrintResult
{
    public bool Success { get; set; }
    public string? JobId { get; set; }
    public string? ErrorMessage { get; set; }
    public string PrinterName { get; set; } = string.Empty;
}
