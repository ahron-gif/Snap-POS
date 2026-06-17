namespace BackOffice.Application.DTOs.Print
{
    public class PairAgentResponseDto
    {
        public bool Paired { get; set; }
        public string Origin { get; set; } = string.Empty;
        public DateTimeOffset PairedAt { get; set; }
    }
}
