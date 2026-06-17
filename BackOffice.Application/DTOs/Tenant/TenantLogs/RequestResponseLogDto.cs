namespace BackOffice.Application.DTOs.Tenant.Logs
{
    /// <summary>
    /// DTO for RequestLog grid display
    /// </summary>
    public class RequestLogGridDto
    {
        public int RequestId { get; set; }
        public string? RequestData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? MethodName { get; set; }
        public string? ControllerName { get; set; }
        public string? RegistrationID { get; set; }
        public string? Token { get; set; }
        public bool HasResponse { get; set; }
    }

    /// <summary>
    /// DTO for ResponseLog grid display
    /// </summary>
    public class ResponseLogGridDto
    {
        public int ResponseId { get; set; }
        public int? RequestId { get; set; }
        public string? RequestData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? MethodName { get; set; }
        public string? ControllerName { get; set; }
        public string? RegistrationID { get; set; }
        public string? Token { get; set; }
    }

    /// <summary>
    /// DTO for combined Request and Response display
    /// </summary>
    public class RequestResponseLogDto
    {
        public int RequestId { get; set; }
        public string? RequestData { get; set; }
        public DateTime? RequestCreatedAt { get; set; }
        public string? MethodName { get; set; }
        public string? ControllerName { get; set; }
        public string? RegistrationID { get; set; }
        public string? Token { get; set; }

        // Response Details
        public int? ResponseId { get; set; }
        public string? ResponseData { get; set; }
        public DateTime? ResponseCreatedAt { get; set; }
    }

    /// <summary>
    /// DTO for Request detail view (includes linked response)
    /// </summary>
    public class RequestLogDetailDto
    {
        public int RequestId { get; set; }
        public string? RequestData { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string? MethodName { get; set; }
        public string? ControllerName { get; set; }
        public string? RegistrationID { get; set; }
        public string? Token { get; set; }

        // Linked response
        public ResponseLogGridDto? Response { get; set; }
    }

    /// <summary>
    /// Filter DTO for Request/Response logs
    /// </summary>
    public class RequestResponseLogFilterDto
    {
        public string? ControllerName { get; set; }
        public string? MethodName { get; set; }
        public string? RegistrationID { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public string? SearchText { get; set; }
    }
}
