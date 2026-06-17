using System.ComponentModel;
using System.Diagnostics;
using System.Drawing.Printing;
using PdfiumViewer;

namespace BackOffice.PrintAgent.Services;

public class PdfPrinter
{
    private readonly ILogger<PdfPrinter> _logger;

    public PdfPrinter(ILogger<PdfPrinter> logger)
    {
        _logger = logger;
    }

    public async Task PrintPdfAsync(string printerName, byte[] pdfBytes, int copies, string jobName, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var jobLabel = string.IsNullOrWhiteSpace(jobName) ? "BackOffice-Print" : jobName!;
        var totalCopies = Math.Max(1, copies);

        try
        {
            await Task.Run(() => PrintWithPdfium(pdfBytes, printerName, totalCopies, jobLabel), cancellationToken);
            _logger.LogDebug("Printed PDF {Job} via PDFium to {Printer}", jobLabel, printerName);
            return;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PDFium in-process printing failed for {Printer}, falling back to external tools", printerName);
        }

        await PrintWithExternalFallbackAsync(pdfBytes, printerName, totalCopies, jobLabel, cancellationToken);
    }

    private static void PrintWithPdfium(byte[] pdfBytes, string printerName, int copies, string jobName)
    {
        using var stream = new MemoryStream(pdfBytes);
        using var document = PdfDocument.Load(stream);
        using var printDoc = document.CreatePrintDocument(PdfPrintMode.ShrinkToMargin);
        printDoc.PrinterSettings = new PrinterSettings
        {
            PrinterName = printerName,
            Copies = (short)copies
        };
        printDoc.DocumentName = jobName;
        printDoc.Print();
    }

    private async Task PrintWithExternalFallbackAsync(byte[] pdfBytes, string printerName, int copies, string jobName, CancellationToken cancellationToken)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "BackOfficePrintAgent");
        Directory.CreateDirectory(tempDir);
        var safeJob = SanitizeJobName(jobName);
        var shortId = Guid.NewGuid().ToString("N").Substring(0, 8);
        var fileName = string.IsNullOrEmpty(safeJob) ? $"job-{shortId}.pdf" : $"{safeJob}-{shortId}.pdf";
        var tempFile = Path.Combine(tempDir, fileName);

        try
        {
            await File.WriteAllBytesAsync(tempFile, pdfBytes, cancellationToken);

            for (int i = 0; i < copies; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                _logger.LogDebug("Printing PDF {Job} copy {Copy} via external tool to {Printer}", jobName, i + 1, printerName);
                PrintWithExternalTool(tempFile, printerName);
            }
        }
        finally
        {
            try { File.Delete(tempFile); } catch { }
        }
    }

    private void PrintWithExternalTool(string filePath, string printerName)
    {
        var attempts = new List<string>();

        var sumatra = FindSumatraPdf();
        if (sumatra != null)
        {
            try
            {
                RunPrinter(sumatra, $"-print-to \"{printerName}\" -silent \"{filePath}\"");
                return;
            }
            catch (Exception ex)
            {
                attempts.Add($"SumatraPDF: {ex.Message}");
                _logger.LogDebug(ex, "SumatraPDF failed, trying Adobe Reader");
            }
        }
        else
        {
            attempts.Add("SumatraPDF: not found next to agent or in Program Files");
        }

        var adobe = FindAdobeReader();
        if (adobe != null)
        {
            try
            {
                RunPrinter(adobe, $"/N /T \"{filePath}\" \"{printerName}\"");
                return;
            }
            catch (Exception ex)
            {
                attempts.Add($"Adobe: {ex.Message}");
                _logger.LogDebug(ex, "Adobe Reader failed, trying shell printto");
            }
        }

        try
        {
            ShellPrintTo(filePath, printerName);
            return;
        }
        catch (Exception ex)
        {
            attempts.Add($"shell printto: {ex.Message}");
        }

        var detail = string.Join(" | ", attempts);
        throw new InvalidOperationException(
            "Could not print the PDF. PDFium failed and no external fallback succeeded. " +
            $"Attempts: {detail}");
    }

    private static void ShellPrintTo(string filePath, string printerName)
    {
        var psi = new ProcessStartInfo
        {
            FileName = filePath,
            Verb = "printto",
            Arguments = $"\"{printerName}\"",
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            UseShellExecute = true
        };

        Process? process;
        try
        {
            process = Process.Start(psi);
        }
        catch (Win32Exception ex)
        {
            throw new InvalidOperationException(
                $"No default app for .pdf is registered (Win32 error {ex.NativeErrorCode}: {ex.Message}).", ex);
        }

        if (process == null)
        {
            throw new InvalidOperationException("Shell printto could not start a handler process.");
        }

        try
        {
            if (!process.WaitForExit(TimeSpan.FromSeconds(60)))
            {
                process.Kill();
                throw new TimeoutException("PDF printer process did not complete within 60 seconds.");
            }
        }
        finally
        {
            process.Dispose();
        }
    }

    private static void RunPrinter(string exePath, string arguments)
    {
        var psi = new ProcessStartInfo
        {
            FileName = exePath,
            Arguments = arguments,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            UseShellExecute = false,
            RedirectStandardError = true,
            RedirectStandardOutput = true
        };

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start '{exePath}'.");

        if (!process.WaitForExit(TimeSpan.FromSeconds(30)))
        {
            try { process.Kill(); } catch { }
            throw new TimeoutException($"'{Path.GetFileName(exePath)}' did not complete within 30 seconds.");
        }

        if (process.ExitCode != 0)
        {
            var stderr = process.StandardError.ReadToEnd().Trim();
            throw new InvalidOperationException(
                $"'{Path.GetFileName(exePath)}' exited with code {process.ExitCode}. {stderr}");
        }
    }

    private static string SanitizeJobName(string? jobName)
    {
        if (string.IsNullOrWhiteSpace(jobName)) return string.Empty;
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(jobName.Select(c => invalid.Contains(c) || c == ' ' ? '-' : c).ToArray());
        cleaned = cleaned.Trim('-', '.');
        return cleaned.Length > 50 ? cleaned.Substring(0, 50) : cleaned;
    }

    private static string? FindSumatraPdf()
    {
        var agentDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(agentDir, "SumatraPDF.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "SumatraPDF", "SumatraPDF.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "SumatraPDF", "SumatraPDF.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SumatraPDF", "SumatraPDF.exe"),
        };
        return candidates.FirstOrDefault(File.Exists);
    }

    private static string? FindAdobeReader()
    {
        var roots = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
        };
        var relativePaths = new[]
        {
            @"Adobe\Acrobat DC\Acrobat\Acrobat.exe",
            @"Adobe\Acrobat Reader DC\Reader\AcroRd32.exe",
            @"Adobe\Reader 11.0\Reader\AcroRd32.exe",
            @"Adobe\Acrobat 11.0\Acrobat\Acrobat.exe",
        };

        foreach (var root in roots)
        {
            foreach (var rel in relativePaths)
            {
                var full = Path.Combine(root, rel);
                if (File.Exists(full)) return full;
            }
        }
        return null;
    }
}
