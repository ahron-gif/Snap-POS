using System.Drawing.Printing;
using BackOffice.PrintAgent.Services.Models;

namespace BackOffice.PrintAgent.Services;

public class PrinterEnumerator : IPrinterEnumerator
{
    private readonly ILogger<PrinterEnumerator> _logger;

    public PrinterEnumerator(ILogger<PrinterEnumerator> logger)
    {
        _logger = logger;
    }

    public IReadOnlyList<PrinterInfo> ListPrinters()
    {
        var defaultName = TryGetDefaultPrinter();
        var result = new List<PrinterInfo>();

        foreach (string name in PrinterSettings.InstalledPrinters)
        {
            try
            {
                var settings = new PrinterSettings { PrinterName = name };
                result.Add(new PrinterInfo
                {
                    Name = name,
                    IsDefault = string.Equals(name, defaultName, StringComparison.OrdinalIgnoreCase),
                    DriverName = settings.PrinterName,
                    PortName = null,
                    Status = settings.IsValid ? "ready" : "invalid"
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to read printer settings for {PrinterName}", name);
                result.Add(new PrinterInfo { Name = name, Status = "error" });
            }
        }

        return result;
    }

    public bool Exists(string printerName)
    {
        if (string.IsNullOrWhiteSpace(printerName)) return false;
        foreach (string name in PrinterSettings.InstalledPrinters)
        {
            if (string.Equals(name, printerName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static string? TryGetDefaultPrinter()
    {
        try
        {
            var s = new PrinterSettings();
            return s.PrinterName;
        }
        catch
        {
            return null;
        }
    }
}
