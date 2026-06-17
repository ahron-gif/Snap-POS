namespace BackOffice.Domain.Entities.Tenant
{
    /// <summary>
    /// Partial for Get_SummaryReport SP result: two columns — label (e.g. "No. of Sales", "Sales") and value (e.g. "0", "$0.00").
    /// If the SP returns different column names, alias them in the SP as Label and Value, or update these property names to match.
    /// </summary>
    public partial class Get_SummaryReportResult
    {
        public string? Description { get; set; }
        public string? Total { get; set; }
    }
}
