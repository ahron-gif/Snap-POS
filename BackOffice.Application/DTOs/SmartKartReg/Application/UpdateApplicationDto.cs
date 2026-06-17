namespace BackOffice.Application.DTOs.SmartKartReg.Application
{
    public class UpdateApplicationDto : CreateApplicationDto
    {
        public Guid AppId { get; set; }
    }
}
