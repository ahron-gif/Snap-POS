namespace BackOffice.PrintAgent.Services.Models;

public class PrintRequest
{
    public string PrinterName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "pdf";
    public string Content { get; set; } = string.Empty;
    public int Copies { get; set; } = 1;
    public string? JobName { get; set; }
}
