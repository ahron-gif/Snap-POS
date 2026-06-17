namespace BackOffice.Application.DTOs.Print
{
    public class PairAgentRequestDto
    {
        public string PairingId { get; set; } = string.Empty;
        public string Secret { get; set; } = string.Empty;
        public string Origin { get; set; } = string.Empty;
    }
}
