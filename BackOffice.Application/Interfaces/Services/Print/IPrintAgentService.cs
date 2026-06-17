using BackOffice.Application.DTOs.Print;

namespace BackOffice.Application.Interfaces.Services.Print
{
    public interface IPrintAgentService
    {
        Task<PairAgentResponseDto> PairAsync(Guid userId, PairAgentRequestDto request);
        Task<PrintAgentStatusDto> GetStatusAsync(Guid userId);
        Task UnpairAsync(Guid userId);
        Task<SignPrintJobResponseDto> SignPrintJobAsync(Guid userId, string origin, SignPrintJobRequestDto request);
    }
}
