namespace BackOffice.Application.DTOs.Main.Billing
{
    public class EstimatedBillDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = null!;
        public string PlanName { get; set; } = null!;
        public DateTime BillingPeriodStart { get; set; }
        public DateTime BillingPeriodEnd { get; set; }
        public List<EstimatedBillLineDto> LineItems { get; set; } = new();
        public decimal SubTotal { get; set; }
        public decimal TaxRate { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
    }

    public class EstimatedBillLineDto
    {
        public string Description { get; set; } = null!;
        public int? AppId { get; set; }
        public int? ApiDefinitionId { get; set; }
        public string Category { get; set; } = null!;
        public int Quantity { get; set; }
        public int FreeUnits { get; set; }
        // Decimal because device-days proration produces fractional device-equivalents.
        public decimal BillableUnits { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
    }
}
