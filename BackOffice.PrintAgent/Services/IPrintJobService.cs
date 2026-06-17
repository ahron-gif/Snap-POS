using BackOffice.PrintAgent.Services.Models;

namespace BackOffice.PrintAgent.Services;

public interface IPrintJobService
{
    Task<PrintResult> PrintAsync(PrintRequest request, CancellationToken cancellationToken);
}
