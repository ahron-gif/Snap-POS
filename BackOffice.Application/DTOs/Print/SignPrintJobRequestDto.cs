namespace BackOffice.Application.DTOs.Print
{
    public class SignPrintJobRequestDto
    {
        public string PrinterName { get; set; } = string.Empty;
        public string ContentType { get; set; } = "pdf";
    }
}
