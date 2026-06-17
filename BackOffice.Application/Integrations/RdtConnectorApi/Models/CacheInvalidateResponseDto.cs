namespace BackOffice.Application.Integrations.RdtConnectorApi.Models
{
    public class CacheInvalidateResponseDto
    {
        public bool Success { get; set; }
        public List<string> RemovedKeys { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }
}
