using BackOffice.PrintAgent.Services.Models;

namespace BackOffice.PrintAgent.Services;

public class PrintJobService : IPrintJobService
{
    private readonly IPrinterEnumerator _printerEnumerator;
    private readonly PdfPrinter _pdfPrinter;
    private readonly ILogger<PrintJobService> _logger;

    public PrintJobService(
        IPrinterEnumerator printerEnumerator,
        PdfPrinter pdfPrinter,
        ILogger<PrintJobService> logger)
    {
        _printerEnumerator = printerEnumerator;
        _pdfPrinter = pdfPrinter;
        _logger = logger;
    }

    public async Task<PrintResult> PrintAsync(PrintRequest request, CancellationToken cancellationToken)
    {
        var jobId = Guid.NewGuid().ToString("N");
        var jobName = string.IsNullOrWhiteSpace(request.JobName) ? $"BackOffice-{jobId[..8]}" : request.JobName!;

        if (!_printerEnumerator.Exists(request.PrinterName))
        {
            _logger.LogWarning("Print job rejected: printer not found {Printer}", request.PrinterName);
            return new PrintResult
            {
                Success = false,
                JobId = jobId,
                PrinterName = request.PrinterName,
                ErrorMessage = $"Printer '{request.PrinterName}' is not installed on this machine."
            };
        }

        byte[] payload;
        try
        {
            payload = Convert.FromBase64String(request.Content);
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(ex, "Print job rejected: invalid base64 payload");
            return new PrintResult
            {
                Success = false,
                JobId = jobId,
                PrinterName = request.PrinterName,
                ErrorMessage = "Invalid base64 content."
            };
        }

        try
        {
            var contentType = (request.ContentType ?? "pdf").Trim().ToLowerInvariant();
            switch (contentType)
            {
                case "pdf":
                    await _pdfPrinter.PrintPdfAsync(request.PrinterName, payload, request.Copies, jobName, cancellationToken);
                    break;
                case "zpl":
                case "escpos":
                case "raw":
                    await Task.Run(() => RawPrinter.SendBytes(request.PrinterName, payload, jobName), cancellationToken);
                    break;
                default:
                    return new PrintResult
                    {
                        Success = false,
                        JobId = jobId,
                        PrinterName = request.PrinterName,
                        ErrorMessage = $"Unsupported contentType '{request.ContentType}'. Allowed: pdf, zpl, escpos, raw."
                    };
            }

            _logger.LogInformation("Print job {JobId} sent to {Printer} ({Type}, {Bytes} bytes)",
                jobId, request.PrinterName, contentType, payload.Length);

            return new PrintResult { Success = true, JobId = jobId, PrinterName = request.PrinterName };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Print job {JobId} failed", jobId);
            return new PrintResult
            {
                Success = false,
                JobId = jobId,
                PrinterName = request.PrinterName,
                ErrorMessage = ex.Message
            };
        }
    }
}
