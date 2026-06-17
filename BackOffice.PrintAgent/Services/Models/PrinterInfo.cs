namespace BackOffice.PrintAgent.Services.Models;

public class PrinterInfo
{
    public string Name { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public string? DriverName { get; set; }
    public string? PortName { get; set; }
    public string? Status { get; set; }
}
