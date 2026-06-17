using BackOffice.PrintAgent.Services.Models;

namespace BackOffice.PrintAgent.Services;

public interface IPrinterEnumerator
{
    IReadOnlyList<PrinterInfo> ListPrinters();
    bool Exists(string printerName);
}
