namespace BackOffice.Application.DTOs.Print
{
    public class PrintAgentStatusDto
    {
        public bool Paired { get; set; }
        public string? Origin { get; set; }
        public DateTimeOffset? PairedAt { get; set; }
    }
}
