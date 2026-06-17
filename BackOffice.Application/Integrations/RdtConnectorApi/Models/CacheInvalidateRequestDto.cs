namespace BackOffice.Application.Integrations.RdtConnectorApi.Models
{
    public class CacheInvalidateRequestDto
    {
        public string Token { get; set; }
        public List<string> Invalidate { get; set; } = new();
    }
}
