namespace BackOffice.Application.DTOs.Print
{
    public class SignPrintJobResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string JobId { get; set; } = string.Empty;
        public DateTimeOffset ExpiresAt { get; set; }
    }
}
